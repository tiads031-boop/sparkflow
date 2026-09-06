import type { Occurrence } from './courseSchedule';
import { localDay } from './courseSchedule';
export function chinaDay(time: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(time));
}
export function courseIsMuted(event: Occurrence, manual: string[], automatic: string[]) {
  return manual.includes(localDay(new Date(event.startTime))) || automatic.includes(chinaDay(event.startTime));
}
export function automationWindows(entries: Occurrence[], manual: string[], automatic: string[]) {
  const sorted = entries.filter(e => !courseIsMuted(e, manual, automatic))
    .map(e => ({ start: Date.parse(e.startTime), end: Date.parse(e.endTime) }))
    .filter(e => Number.isFinite(e.start) && e.end > e.start).sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const e of sorted) { const last = merged.at(-1); if (last && e.start <= last.end) last.end = Math.max(last.end, e.end); else merged.push({ ...e }); }
  return merged;
}
