import type { AnalyticsService } from '../analytics/analytics.service';
import type { PlanningExecutionFeedbackSnapshot } from '../ai/ai-provider';

const DAY_MS = 86_400_000;

/** Read-only snapshot. Never persist analytics as user-confirmed preferences. */
export async function loadExecutionFeedback(
  analytics: AnalyticsService,
  userId: string,
  now: Date,
  timeZone: string,
  goalId?: string | null,
): Promise<PlanningExecutionFeedbackSnapshot> {
  const end = now.toISOString();
  const last7 = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const last28 = new Date(now.getTime() - 28 * DAY_MS).toISOString();
  const [recent, month, comparison] = await Promise.all([
    analytics.getTime(userId, last7, end, timeZone, 'day', 'goal'),
    analytics.getTime(userId, last28, end, timeZone, 'day', 'tag'),
    analytics.getPlanActual(userId, last28, end, timeZone, 'day'),
  ]);
  const reliable = comparison.matches.filter(
    (match) => match.confidence === 'exact' || match.confidence === 'strong',
  );
  const goalSeconds = goalId
    ? (recent.breakdown.find((item) => item.key === goalId)?.actualSeconds ?? 0)
    : undefined;
  const lateByHour = new Map<number, number>();
  for (const match of reliable) {
    if (!match.plannedStart || (match.startDeltaMinutes ?? 0) < 10) continue;
    const localHour = Number(
      new Intl.DateTimeFormat('en', {
        timeZone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(match.plannedStart)),
    );
    lateByHour.set(localHour, (lateByHour.get(localHour) ?? 0) + 1);
  }
  const recurring = [...lateByHour.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    provenance: 'measured',
    observedAt: end,
    actualMinutesLast7Days: Math.round(recent.totalActualSeconds / 60),
    actualMinutesLast28Days: Math.round(month.totalActualSeconds / 60),
    plannedMinutesLast28Days: Math.round(comparison.plannedSeconds / 60),
    unplannedMinutesLast28Days: Math.round(
      comparison.unplannedActualSeconds / 60,
    ),
    reliableLateStartsLast28Days: reliable.filter(
      (match) =>
        match.startDeltaMinutes !== undefined && match.startDeltaMinutes >= 10,
    ).length,
    comparableSessionsLast28Days: reliable.length,
    inferredMatchesLast28Days: comparison.matches.filter(
      (match) => match.confidence === 'inferred',
    ).length,
    topTagsLast28Days: month.breakdown
      .filter((item) => item.key !== 'untagged')
      .slice(0, 3)
      .map((item) => ({
        name: item.label,
        minutes: Math.round(item.actualSeconds / 60),
      })),
    ...(recurring && recurring[1] >= 3
      ? {
          recurrentLateStartHour: {
            localHour: recurring[0],
            count: recurring[1],
          },
        }
      : {}),
    ...(goalSeconds !== undefined
      ? { goalActualMinutesLast7Days: Math.round(goalSeconds / 60) }
      : {}),
  };
}
