import type { ScheduleItem } from '../../types';

interface RhythmDialProps {
  items: readonly ScheduleItem[];
  now: Date;
  onSelect: (item: ScheduleItem) => void;
}

const START_HOUR = 6;
const END_HOUR = 24;
const CIRCUMFERENCE = 2 * Math.PI * 104;

function minutesSinceStart(iso: string, day: Date) {
  const rangeStart = new Date(day);
  rangeStart.setHours(START_HOUR, 0, 0, 0);
  return (new Date(iso).getTime() - rangeStart.getTime()) / 60_000;
}

export default function RhythmDial({ items, now, onSelect }: RhythmDialProps) {
  const totalMinutes = (END_HOUR - START_HOUR) * 60;
  const next = items.find((item) => new Date(item.end) > now);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[310px]">
      <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90" aria-label="今日节奏表盘">
        <circle cx="120" cy="120" r="104" fill="none" stroke="var(--sf-divider)" strokeWidth="18" />
        {items.map((item) => {
          const start = Math.max(0, minutesSinceStart(item.start, now));
          const end = Math.min(totalMinutes, minutesSinceStart(item.end, now));
          if (end <= start) return null;
          const length = ((end - start) / totalMinutes) * CIRCUMFERENCE;
          const offset = -((start / totalMinutes) * CIRCUMFERENCE);
          return (
            <circle
              key={item.id}
              cx="120" cy="120" r="104" fill="none" stroke={item.color} strokeWidth="18" strokeLinecap="round"
              strokeDasharray={`${length} ${CIRCUMFERENCE - length}`} strokeDashoffset={offset}
              className="cursor-pointer transition-[stroke-width] hover:stroke-[22px]"
              onClick={() => onSelect(item)}
            />
          );
        })}
      </svg>
      <div className="absolute inset-[20%] flex flex-col items-center justify-center rounded-full bg-[var(--sf-surface)] text-center shadow-sm">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--sf-text-tertiary)]">Rhythm</span>
        <strong className="mt-1 text-3xl tracking-tight">{now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</strong>
        <span className="mt-2 max-w-[130px] truncate text-xs text-[var(--sf-text-secondary)]">
          {next ? `下一项 · ${new Date(next.start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}` : '今天没有更多安排'}
        </span>
        {next && <span className="max-w-[130px] truncate text-sm font-bold">{next.title}</span>}
      </div>
    </div>
  );
}
