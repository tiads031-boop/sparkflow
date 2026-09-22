import type { ActualTimelineEntry } from '../../api/actualTimeline';
import type { ExecutionMatch } from './executionMatching';

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function ActualCompareTrack({ entry, match }: { entry: ActualTimelineEntry; match: ExecutionMatch }) {
  if (!match.planned) {
    return <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--sf-bg)]"><span className="block h-full w-full rounded-full bg-[var(--sf-green-strong)]" /></div>;
  }
  const plannedStart = new Date(match.planned.start).getTime();
  const plannedEnd = new Date(match.planned.end).getTime();
  const actualStart = new Date(entry.start).getTime();
  const actualEnd = new Date(entry.end).getTime();
  const rangeStart = Math.min(plannedStart, actualStart);
  const rangeEnd = Math.max(plannedEnd, actualEnd);
  const range = Math.max(1, rangeEnd - rangeStart);
  const style = (start: number, end: number) => ({ left: `${((start - rangeStart) / range) * 100}%`, width: `${Math.max(4, ((end - start) / range) * 100)}%` });

  return (
    <div className="mt-2" aria-label={`计划 ${formatTime(match.planned.start)} 到 ${formatTime(match.planned.end)}，实际 ${formatTime(entry.start)} 到 ${formatTime(entry.end)}`}>
      <div className="relative h-3 rounded-full bg-[var(--sf-bg)]">
        <span className="absolute top-0 h-1 rounded-full bg-[var(--sf-blue)]" style={style(plannedStart, plannedEnd)} />
        <span className="absolute bottom-0 h-1.5 rounded-full bg-[var(--sf-green-strong)]" style={style(actualStart, actualEnd)} />
      </div>
      <div className="mt-1 flex justify-between text-[8px] text-[var(--sf-text-tertiary)]"><span>计划（蓝）</span><span>实际（绿）</span></div>
    </div>
  );
}
