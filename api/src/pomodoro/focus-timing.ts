export interface FocusSegmentLike {
  startedAt: Date;
  endedAt: Date | null;
}

export interface FocusSessionTimingLike {
  startedAt: Date;
  endedAt: Date | null;
  status: string;
  focusMode?: string;
  plannedDurationSeconds: number;
  segments: FocusSegmentLike[];
}

export function focusCompletionTime(
  session: FocusSessionTimingLike,
  now = new Date(),
) {
  if (session.endedAt) return session.endedAt;
  if (session.status !== 'active') return now;
  if (session.focusMode === 'countup') return now;
  const open = session.segments.find((segment) => !segment.endedAt);
  if (!open) return now;
  const closedSeconds = session.segments.reduce((total, segment) => {
    if (!segment.endedAt) return total;
    return (
      total +
      Math.max(
        0,
        (segment.endedAt.getTime() - segment.startedAt.getTime()) / 1000,
      )
    );
  }, 0);
  const remainingSeconds = Math.max(
    0,
    session.plannedDurationSeconds - closedSeconds,
  );
  const exhaustion = new Date(
    open.startedAt.getTime() + remainingSeconds * 1000,
  );
  return exhaustion < now ? exhaustion : now;
}

export function calculateFocusTiming(
  session: FocusSessionTimingLike,
  now = new Date(),
) {
  const end = session.endedAt ?? now;
  const rawEffective = session.segments.reduce((total, segment) => {
    const segmentEnd =
      segment.endedAt ??
      (session.status === 'active' ? end : segment.startedAt);
    return (
      total +
      Math.max(0, (segmentEnd.getTime() - segment.startedAt.getTime()) / 1000)
    );
  }, 0);
  const effectiveDurationSeconds = Math.round(
    session.focusMode === 'countup'
      ? rawEffective
      : Math.min(session.plannedDurationSeconds, rawEffective),
  );
  const elapsedDurationSeconds = Math.max(
    0,
    Math.round((end.getTime() - session.startedAt.getTime()) / 1000),
  );
  return {
    effectiveDurationSeconds,
    elapsedDurationSeconds,
    pausedDurationSeconds: Math.max(
      0,
      elapsedDurationSeconds - effectiveDurationSeconds,
    ),
    remainingSeconds:
      session.focusMode === 'countup'
        ? 0
        : Math.max(
            0,
            session.plannedDurationSeconds - effectiveDurationSeconds,
          ),
  };
}
