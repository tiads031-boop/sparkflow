export type WeekAdjustmentMode = 'move' | 'resize';

function snapQuarter(minutes: number) {
  return Math.round(minutes / 15) * 15;
}

/** Draft a change in local calendar time; persistence belongs to ScheduleEditor. */
export function proposeWeekAdjustment(
  start: Date,
  end: Date,
  day: Date,
  deltaMinutes: number,
  dayOffset: number,
  mode: WeekAdjustmentMode,
) {
  const durationMinutes = (end.getTime() - start.getTime()) / 60_000;
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1) return null;

  const targetDay = new Date(day);
  targetDay.setDate(day.getDate() + (mode === 'move' ? dayOffset : 0));
  targetDay.setHours(0, 0, 0, 0);
  if (mode === 'move') {
    const originalMinute = start.getHours() * 60 + start.getMinutes();
    const latestStart = Math.floor((1440 - durationMinutes) / 15) * 15;
    const minute = Math.max(0, Math.min(latestStart, snapQuarter(originalMinute + deltaMinutes)));
    const nextStart = new Date(targetDay);
    nextStart.setMinutes(minute);
    return { start: nextStart, end: new Date(nextStart.getTime() + durationMinutes * 60_000) };
  }

  const originalEndMinute = end.getHours() * 60 + end.getMinutes();
  const endMinute = Math.max(0, Math.min(1440, snapQuarter(originalEndMinute + deltaMinutes)));
  const nextEnd = new Date(targetDay);
  nextEnd.setMinutes(endMinute);
  if (nextEnd.getTime() - start.getTime() < 60_000) return null;
  return { start: new Date(start), end: nextEnd };
}
