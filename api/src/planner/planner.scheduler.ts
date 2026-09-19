export interface PlannerTaskInput {
  id: string;
  title: string;
  durationMinutes: number;
  priority: string;
  dueAt?: Date | null;
  updatedAt: Date;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface PlannerProposal {
  taskId: string;
  title: string;
  start: string;
  end: string;
  durationMinutes: number;
  taskUpdatedAt: string;
  reason: string;
  originalStart?: string;
  originalEnd?: string;
}

const PRIORITY_WEIGHT: Record<string, number> = { high: 0, medium: 1, low: 2 };

function overlaps(start: Date, end: Date, interval: BusyInterval) {
  return start < interval.end && end > interval.start;
}

function ceilToQuarter(date: Date) {
  const result = new Date(date);
  result.setSeconds(0, 0);
  const remainder = result.getMinutes() % 15;
  if (remainder) result.setMinutes(result.getMinutes() + 15 - remainder);
  return result;
}

export function buildScheduleInWindows(
  tasks: readonly PlannerTaskInput[],
  occupied: readonly BusyInterval[],
  availabilityWindows: readonly BusyInterval[],
): { proposals: PlannerProposal[]; unscheduledTaskIds: string[] } {
  const windows = availabilityWindows
    .filter((window) => window.end > window.start)
    .map((window) => ({
      start: new Date(window.start),
      end: new Date(window.end),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const busy = occupied.map((item) => ({
    start: new Date(item.start),
    end: new Date(item.end),
  }));
  const proposals: PlannerProposal[] = [];
  const unscheduledTaskIds: string[] = [];
  const ordered = [...tasks].sort(
    (left, right) =>
      (PRIORITY_WEIGHT[left.priority] ?? 1) -
        (PRIORITY_WEIGHT[right.priority] ?? 1) ||
      (left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
      left.id.localeCompare(right.id),
  );

  for (const task of ordered) {
    const durationMinutes = Math.min(
      240,
      Math.max(15, Math.round(task.durationMinutes || 30)),
    );
    let placed = false;

    for (const window of windows) {
      if (task.dueAt && window.start >= task.dueAt) continue;
      let cursor = ceilToQuarter(window.start);

      while (cursor < window.end) {
        const end = new Date(cursor.getTime() + durationMinutes * 60_000);
        if (end > window.end || (task.dueAt && end > task.dueAt)) break;

        const conflict = busy
          .filter((item) => overlaps(cursor, end, item))
          .sort((a, b) => a.end.getTime() - b.end.getTime())[0];

        if (!conflict) {
          const reason =
            task.priority === 'high'
              ? '优先安排高优先级任务'
              : task.dueAt
                ? '按截止时间优先安排'
                : '放入最早完整空档';
          proposals.push({
            taskId: task.id,
            title: task.title,
            start: cursor.toISOString(),
            end: end.toISOString(),
            durationMinutes,
            taskUpdatedAt: task.updatedAt.toISOString(),
            reason,
          });
          busy.push({ start: cursor, end });
          placed = true;
          break;
        }

        cursor = ceilToQuarter(conflict.end);
      }

      if (placed) break;
    }

    if (!placed) unscheduledTaskIds.push(task.id);
  }

  return {
    proposals: proposals.sort((a, b) => a.start.localeCompare(b.start)),
    unscheduledTaskIds,
  };
}

export function buildSchedule(
  tasks: readonly PlannerTaskInput[],
  occupied: readonly BusyInterval[],
  availabilityStart: Date,
  availabilityEnd: Date,
): { proposals: PlannerProposal[]; unscheduledTaskIds: string[] } {
  return buildScheduleInWindows(tasks, occupied, [{
    start: availabilityStart,
    end: availabilityEnd,
  }]);
}

export function hasOverlap(intervals: readonly BusyInterval[]) {
  const ordered = [...intervals].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  return ordered.some(
    (item, index) => index > 0 && item.start < ordered[index - 1].end,
  );
}
