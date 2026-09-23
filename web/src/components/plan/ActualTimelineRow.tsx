import { Pencil, Trash2 } from 'lucide-react';
import type { ActualTimelineEntry } from '../../api/actualTimeline';
import type { ExecutionMatch } from './executionMatching';
import { StatusChip, TagChip } from '../ui/foundation';
import ActualCompareTrack from './ActualCompareTrack';

function time(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function duration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim() : `${minutes}m`;
}

export default function ActualTimelineRow({ entry, match, compare, onOpenTask, onEdit, onDelete }: {
  entry: ActualTimelineEntry;
  match: ExecutionMatch;
  compare: boolean;
  onOpenTask?: (taskId: string) => void;
  onEdit: (entry: ActualTimelineEntry) => void;
  onDelete: (entry: ActualTimelineEntry) => void;
}) {
  const warning = match.relation !== 'on_time' && match.relation !== 'unplanned';
  return (
    <article className="relative grid grid-cols-[38px_10px_minmax(0,1fr)] items-start gap-2">
      <span className="pt-3 text-right text-[10px] font-black text-[var(--sf-text-secondary)]">{time(entry.start)}</span>
      <span className="relative z-10 mt-4 h-2.5 w-2.5 rounded-full border-2 border-[var(--sf-bg)] bg-[var(--sf-purple)]" aria-hidden="true" />
      <div className="min-w-0 rounded-[19px] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-3 shadow-[0_5px_16px_rgba(25,31,28,0.055)]">
        <div className="flex min-w-0 flex-wrap items-start gap-2">
          <button type="button" onClick={() => entry.taskId && onOpenTask?.(entry.taskId)} disabled={!entry.taskId} className="min-w-0 flex-1 text-left">
            <strong className="block truncate text-xs font-black text-[var(--sf-text-primary)]">{entry.title}</strong>
            <span className="mt-0.5 block text-[9px] text-[var(--sf-text-tertiary)]">{entry.source === 'manual' ? '手工补记' : 'Focus'} · {time(entry.start)}–{time(entry.end)} · 有效 {duration(entry.effectiveDurationSeconds)}</span>
          </button>
          <StatusChip tone={warning ? 'warning' : match.relation === 'on_time' ? 'success' : 'neutral'}>{match.label}</StatusChip>
          {entry.source === 'manual' && <button type="button" onClick={() => onEdit(entry)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--sf-bg)]" aria-label={`编辑 ${entry.title}`}><Pencil size={12} /></button>}
          <button type="button" onClick={() => onDelete(entry)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--sf-text-tertiary)] hover:bg-red-50 hover:text-red-600" aria-label={`删除 ${entry.title}`}><Trash2 size={12} /></button>
        </div>
        {compare && <ActualCompareTrack entry={entry} match={match} />}
        {entry.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{entry.tags.map((tag) => <TagChip key={tag} name={tag} />)}</div>}
        {entry.notes && <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-[var(--sf-text-secondary)]">{entry.notes}</p>}
      </div>
    </article>
  );
}
