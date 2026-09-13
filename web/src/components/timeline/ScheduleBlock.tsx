import { Lock } from 'lucide-react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { ScheduleItem } from '../../types';
import { formatTime } from './timelineUtils';

interface Props {
  item: ScheduleItem;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  onClick?: () => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

export default function ScheduleBlock({ item, compact, className = '', style, children, onClick, onPointerDown }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={`group overflow-hidden rounded-xl border-l-4 bg-[var(--sf-surface)] text-left shadow-sm ${item.completed ? 'opacity-55' : ''} ${className}`}
      style={{ borderLeftColor: item.color, ...style }}
      title={`${item.title} · ${formatTime(item.start)}–${formatTime(item.end)}`}
    >
      <span className={`flex items-center gap-1 font-semibold ${compact ? 'truncate px-1.5 py-1 text-[10px]' : 'px-3 pt-2 text-xs'}`}>
        <span className="truncate">{item.title}</span>{item.locked && <Lock size={compact ? 9 : 12} className="shrink-0" aria-label="已锁定" />}
      </span>
      {!compact && <span className="block px-3 pb-2 text-[10px] text-[var(--sf-text-tertiary)]">{formatTime(item.start)} · {item.durationMinutes} 分钟</span>}
      {children}
    </button>
  );
}

