export interface TimetableInterval {
  first: number;
  last: number;
}

export type TimetableLayout<T extends TimetableInterval> = T & {
  lane: number;
  laneCount: number;
};

/** Combines duplicate fragments of one course before collision lanes are assigned. */
export function mergeTimetableIntervals<T extends TimetableInterval>(
  items: T[],
  getKey: (item: T) => string,
  combine: (previous: T, incoming: T) => T = (previous, incoming) => ({
    ...previous,
    first: Math.min(previous.first, incoming.first),
    last: Math.max(previous.last, incoming.last),
  }),
): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  return [...groups.values()].flatMap((group) => {
    const sorted = [...group].sort((a, b) => a.first - b.first || a.last - b.last);
    const merged: T[] = [];

    for (const item of sorted) {
      const previous = merged.at(-1);
      if (!previous || item.first > previous.last + 1) {
        merged.push(item);
        continue;
      }
      merged[merged.length - 1] = combine(previous, item);
    }
    return merged;
  });
}

/**
 * Places overlapping timetable intervals into side-by-side lanes.
 * Intervals are inclusive because they represent school periods rather than
 * continuous timestamps (for example, first=0/last=1 spans periods 1 and 2).
 */
export function layoutTimetableIntervals<T extends TimetableInterval>(items: T[]): TimetableLayout<T>[] {
  const sorted = items
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((a, b) => a.item.first - b.item.first || a.item.last - b.item.last || a.sourceIndex - b.sourceIndex);
  const result: TimetableLayout<T>[] = [];

  for (let cursor = 0; cursor < sorted.length;) {
    const group: typeof sorted = [];
    let groupLast = sorted[cursor].item.last;
    let end = cursor;

    while (end < sorted.length && sorted[end].item.first <= groupLast) {
      group.push(sorted[end]);
      groupLast = Math.max(groupLast, sorted[end].item.last);
      end += 1;
    }

    const laneEnds: number[] = [];
    const positioned = group.map(({ item, sourceIndex }) => {
      let lane = laneEnds.findIndex((last) => last < item.first);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = item.last;
      return { item, lane, sourceIndex };
    });
    const laneCount = laneEnds.length;

    result.push(...positioned
      .sort((a, b) => a.sourceIndex - b.sourceIndex)
      .map(({ item, lane }) => ({ ...item, lane, laneCount })));
    cursor = end;
  }

  return result;
}
