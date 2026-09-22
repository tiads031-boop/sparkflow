import { Loader2 } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { deleteActualTime, getActualTimeline, type ActualTimelineEntry } from '../../api/actualTimeline';
import type { Task } from '../../types';
import { EmptyState, SectionCard } from '../ui/foundation';
import ActualEditorSheet, { type ActualEditorRange } from './ActualEditorSheet';
import ActualTimelineGap from './ActualTimelineGap';
import ActualTimelineHeader, { type ActualTimelineMode } from './ActualTimelineHeader';
import ActualTimelineRow from './ActualTimelineRow';
import { findActualTimelineGaps, matchActualToPlan, type ActualTimelineGapValue } from './executionMatching';
import { addLocalDays, itemsForLocalDay, localDateKey, startOfLocalDay, type PlanItem } from './planProjection';

interface ActualTimelineWorkspaceProps {
  selectedDate: Date;
  plannedItems: PlanItem[];
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
}

function defaultRange(date: Date): ActualEditorRange {
  const end = new Date(date);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) end.setTime(today.getTime());
  else end.setHours(18, 0, 0, 0);
  return { start: new Date(end.getTime() - 60 * 60_000).toISOString(), end: end.toISOString() };
}

function duration(seconds: number) {
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} 小时${rest ? ` ${rest} 分钟` : ''}` : `${minutes} 分钟`;
}

export default function ActualTimelineWorkspace({ selectedDate, plannedItems, tasks, onTaskClick }: ActualTimelineWorkspaceProps) {
  const [mode, setMode] = useState<ActualTimelineMode>('actual');
  const [entries, setEntries] = useState<ActualTimelineEntry[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editingEntry, setEditingEntry] = useState<ActualTimelineEntry | null>(null);
  const [editorRange, setEditorRange] = useState<ActualEditorRange | null>(null);
  const requestKey = `${localDateKey(selectedDate)}:${revision}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const start = startOfLocalDay(selectedDate);
    const end = addLocalDays(start, 1);
    void getActualTimeline(start.toISOString(), end.toISOString(), controller.signal)
      .then((result) => { setEntries((result || []).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())); setError(''); setLoadedKey(requestKey); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) { setEntries([]); setError(reason instanceof Error ? reason.message : '加载实际时间失败'); setLoadedKey(requestKey); } });
    return () => controller.abort();
  }, [requestKey, selectedDate]);

  const planned = useMemo(() => itemsForLocalDay(plannedItems, selectedDate).filter((item) => !item.preview), [plannedItems, selectedDate]);
  const matches = useMemo(() => new Map(entries.map((entry) => [entry.id, matchActualToPlan(entry, planned)])), [entries, planned]);
  const gaps = useMemo(() => new Map(findActualTimelineGaps(entries).map((gap) => [gap.id.split(':')[1], gap])), [entries]);
  const totalSeconds = entries.reduce((sum, entry) => sum + entry.effectiveDurationSeconds, 0);

  const changed = () => {
    setRevision((value) => value + 1);
    window.dispatchEvent(new CustomEvent('sparkflow:actual-changed'));
  };
  const openNew = (range = defaultRange(selectedDate)) => { setEditingEntry(null); setEditorRange(range); };
  const openGap = (gap: ActualTimelineGapValue) => openNew({ start: gap.start, end: gap.end });
  const openEdit = (entry: ActualTimelineEntry) => { setEditingEntry(entry); setEditorRange({ start: entry.start, end: entry.end }); };
  const remove = async (entry: ActualTimelineEntry) => {
    if (!window.confirm(`删除“${entry.title}”这条实际时间记录？`)) return;
    try { await deleteActualTime(entry.id); changed(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : '删除实际时间失败'); }
  };

  return (
    <div className="space-y-3">
      <ActualTimelineHeader mode={mode} totalLabel={duration(totalSeconds)} onModeChange={setMode} onAdd={() => openNew()} />
      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-[var(--sf-text-tertiary)]"><Loader2 size={15} className="animate-spin" />读取实际执行记录…</div>
      ) : entries.length ? (
        <SectionCard className="!p-3">
          <div className="space-y-2">
            {entries.map((entry) => {
              const gap = gaps.get(entry.id);
              return <Fragment key={entry.id}>{gap && <ActualTimelineGap gap={gap} onAdd={openGap} />}<ActualTimelineRow entry={entry} match={matches.get(entry.id)!} compare={mode === 'compare'} onOpenTask={onTaskClick} onEdit={openEdit} onDelete={(item) => void remove(item)} /></Fragment>;
            })}
          </div>
        </SectionCard>
      ) : <EmptyState title="这一天还没有实际时间记录" description="完成 Focus 后会自动出现，也可以补记未使用计时器的投入。" />}
      <p className="px-2 text-[9px] leading-4 text-[var(--sf-text-tertiary)]">Actual 只来自 PomodoroSession；Focus 暂停不计入有效时长。计划对照按任务关系、标题与时间置信度匹配。</p>
      {editorRange && <ActualEditorSheet key={`${editingEntry?.id || 'new'}:${editorRange.start}:${editorRange.end}`} entry={editingEntry} range={editorRange} tasks={tasks} onClose={() => { setEditingEntry(null); setEditorRange(null); }} onSaved={changed} />}
    </div>
  );
}
