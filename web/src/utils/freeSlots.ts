import type { ScheduleItem } from '../types';

export interface FreeSlot {
  start: string;
  end: string;
  durationMinutes: number;
}

export function computeFreeSlots(
  items: readonly Pick<ScheduleItem, 'start' | 'end'>[],
  availabilityStart: Date,
  availabilityEnd: Date,
  minDuration = 15,
): FreeSlot[] {
  if (availabilityEnd <= availabilityStart) return [];
  const ranges = items
    .map((item) => [new Date(item.start), new Date(item.end)] as const)
    .filter(([start, end]) => !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > availabilityStart && start < availabilityEnd)
    .map(([start, end]) => [
      new Date(Math.max(start.getTime(), availabilityStart.getTime())),
      new Date(Math.min(end.getTime(), availabilityEnd.getTime())),
    ] as const)
    .sort((a, b) => a[0].getTime() - b[0].getTime());

  const merged: Array<[Date, Date]> = [];
  for (const [start, end] of ranges) {
    const last = merged.at(-1);
    if (last && start <= last[1]) {
      if (end > last[1]) last[1] = end;
    } else {
      merged.push([start, end]);
    }
  }

  const result: FreeSlot[] = [];
  let cursor = availabilityStart;
  for (const [start, end] of merged) {
    if (start > cursor) pushSlot(result, cursor, start, minDuration);
    if (end > cursor) cursor = end;
  }
  if (cursor < availabilityEnd) pushSlot(result, cursor, availabilityEnd, minDuration);
  return result;
}

function pushSlot(result: FreeSlot[], start: Date, end: Date, minDuration: number) {
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (durationMinutes >= minDuration) {
    result.push({ start: start.toISOString(), end: end.toISOString(), durationMinutes });
  }
}
