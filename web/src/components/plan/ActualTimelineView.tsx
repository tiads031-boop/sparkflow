import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock3, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  createManualActualTime,
  deleteActualTime,
  getActualTimeline,
  type ActualTimelineEntry,
} from '../../api/actualTimeline';
import type { Task } from '../../types';
import TagSelector from '../tags/TagSelector';
import { BottomActionBar, EmptyState, SectionCard, SegmentControl, TagChip } from '../ui/foundation';
import { addLocalDays, itemsForLocalDay, localDateKey, startOfLocalDay, type PlanItem } from './planProjection';

type TimelineMode = 'actual' | 'compare';

interface ActualTimelineViewProps {
  selectedDate: Date;
  plannedItems: PlanItem[];
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
}

function localInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function defaultRange(date: Date) {
  const end = new Date(date);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) end.setTime(today.getTime());
  else end.setHours(18, 0, 0, 0);
  const start = new Date(end.getTime() - 60 * 60_000);
  return { start: localInputValue(start), end: localInputValue(end) };
}

function time(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function duration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${minutes} 分钟`;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

export default function ActualTimelineView({
  selectedDate,
  plannedItems,
  tasks,
  onTaskClick,
}: ActualTimelineViewProps) {
  const [mode, setMode] = useState<TimelineMode>('actual');
  const [entries, setEntries] = useState<ActualTimelineEntry[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const defaults = useMemo(() => defaultRange(selectedDate), [selectedDate]);
  const [title, setTitle] = useState('');
  const [taskId, setTaskId] = useState('');
  const [startedAt, setStartedAt] = useState(defaults.start);
  const [endedAt, setEndedAt] = useState(defaults.end);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const requestKey = `${localDateKey(selectedDate)}:${revision}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const start = startOfLocalDay(selectedDate);
    const end = addLocalDays(start, 1);
    void getActualTimeline(start.toISOString(), end.toISOString(), controller.signal)
      .then((result) => {
        setEntries(result || []);
        setError('');
        setLoadedKey(requestKey);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setEntries([]);
          setError(reason instanceof Error ? reason.message : '加载实际时间失败');
          setLoadedKey(requestKey);
        }
      });
    return () => controller.abort();
  }, [requestKey, selectedDate]);

  const planned = useMemo(
    () => itemsForLocalDay(plannedItems, selectedDate).filter((item) => !item.preview),
    [plannedItems, selectedDate],
  );
  const totalSeconds = entries.reduce((sum, entry) => sum + entry.effectiveDurationSeconds, 0);

  const resetForm = () => {
    setTitle('');
    setTaskId('');
    setStartedAt(defaults.start);
    setEndedAt(defaults.end);
    setNotes('');
    setTags([]);
    setShowForm(false);
  };

  const openForm = () => {
    setStartedAt(defaults.start);
    setEndedAt(defaults.end);
    setShowForm(true);
  };

  const save = async () => {
    if ((!title.trim() && !taskId) || !startedAt || !endedAt || saving) return;
    setSaving(true);
    setError('');
    try {
      await createManualActualTime({
        title: title.trim() || undefined,
        taskId: taskId || undefined,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        notes: notes.trim() || undefined,
        tags,
        clientRequestId: crypto.randomUUID(),
      });
      resetForm();
      setRevision((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存实际时间失败');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry: ActualTimelineEntry) => {
    if (!window.confirm(`删除“${entry.title}”这条实际时间记录？`)) return;
    try {
      await deleteActualTime(entry.id);
      setRevision((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除实际时间失败');
    }
  };

  return (
    <div className="space-y-3">
      <SectionCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sf-text-tertiary)]">Actual Timeline</p>
            <h2 className="mt-0.5 text-sm font-black">实际时间 · {duration(totalSeconds)}</h2>
          </div>
          <button type="button" onClick={openForm} className="inline-flex items-center gap-1 rounded-full bg-[var(--sf-text-primary)] px-3 py-2 text-[10px] font-black text-[var(--sf-surface)]">
            <Plus size={13} /> 补记
          </button>
        </div>
        <div className="mt-3">
          <SegmentControl value={mode} onChange={setMode} ariaLabel="时间线显示模式" options={[
            { value: 'actual', label: '仅实际' },
            { value: 'compare', label: '计划对照' },
          ]} />
        </div>
      </SectionCard>

      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-[var(--sf-text-tertiary)]"><Loader2 size={15} className="animate-spin" />读取实际执行记录…</div>
      ) : entries.length ? (
        <SectionCard className="!p-3">
          <div className="relative space-y-2 before:absolute before:bottom-4 before:left-[44px] before:top-4 before:w-px before:bg-black/[0.08]">
            {entries.map((entry) => (
              <div key={entry.id} className="relative flex gap-3 rounded-2xl bg-[var(--sf-bg)] px-2 py-3">
                <span className="w-8 shrink-0 pt-0.5 text-right text-[9px] font-black text-[var(--sf-text-secondary)]">{time(entry.start)}</span>
                <span className={`relative z-10 mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 border-white shadow-sm ${entry.source === 'manual' ? 'bg-[#8fc7bb]' : 'bg-[#b0a8db]'}`} />
                <button type="button" onClick={() => entry.taskId && onTaskClick?.(entry.taskId)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-xs font-black">{entry.title}</span>
                  <span className="mt-0.5 block text-[9px] text-[var(--sf-text-tertiary)]">
                    {entry.source === 'manual' ? '手工补记' : entry.status === 'interrupted' ? '提前结束的专注' : 'Focus'} · {time(entry.start)}–{time(entry.end)} · 有效 {duration(entry.effectiveDurationSeconds)}
                  </span>
                  {entry.pausedDurationSeconds > 0 && <span className="mt-0.5 block text-[9px] text-[var(--sf-text-tertiary)]">暂停 {duration(entry.pausedDurationSeconds)}，统计只计有效时长</span>}
                  {entry.tags.length > 0 && <span className="mt-2 flex flex-wrap gap-1">{entry.tags.map((tag) => <TagChip key={tag} name={tag} />)}</span>}
                  {entry.notes && <span className="mt-1 block line-clamp-2 text-[10px] text-[var(--sf-text-secondary)]">{entry.notes}</span>}
                </button>
                <button type="button" onClick={() => void remove(entry)} aria-label="删除实际时间记录" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--sf-text-tertiary)] hover:bg-red-50 hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : (
        <EmptyState title="这一天还没有实际时间记录" description="完成 Focus 后会自动出现，也可以补记未使用计时器的投入。" />
      )}

      {mode === 'compare' && (
        <SectionCard>
          <div className="mb-3 flex items-center gap-2"><CalendarClock size={15} /><h3 className="text-xs font-black">原计划</h3></div>
          {planned.length ? <div className="space-y-2">{planned.map((item) => (
            <button key={item.id} type="button" onClick={() => item.taskId && onTaskClick?.(item.taskId)} className="flex w-full items-center gap-3 rounded-2xl bg-[var(--sf-bg)] px-3 py-2.5 text-left">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="min-w-0 flex-1 truncate text-xs font-bold">{item.title}</span>
              <span className="text-[9px] text-[var(--sf-text-tertiary)]">{time(item.start)}–{time(item.end)}</span>
            </button>
          ))}</div> : <p className="rounded-2xl bg-[var(--sf-bg)] px-3 py-6 text-center text-xs text-[var(--sf-text-tertiary)]">这一天没有排入日程的计划</p>}
        </SectionCard>
      )}

      <p className="px-2 text-[9px] leading-4 text-[var(--sf-text-tertiary)]">实际时间来自 PomodoroSession；Focus 暂停时间不会计入有效时长。计划来自 Task、Course 与 CalendarEvent，未排期待办不会进入对照。</p>

      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/35 p-2 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="补记实际时间">
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-[var(--sf-surface)] p-5 shadow-2xl">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sf-text-tertiary)]">Manual Actual</p><h2 className="text-lg font-black">补记实际时间</h2></div><button type="button" onClick={resetForm} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--sf-bg)]" aria-label="关闭"><X size={15} /></button></div>
            <div className="mt-4 space-y-3">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="做了什么（选择任务后可不填）" className="w-full rounded-2xl bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none" />
              <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="w-full rounded-2xl bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none"><option value="">不关联任务</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select>
              <div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-bold text-[var(--sf-text-tertiary)]">开始<input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} className="mt-1 w-full rounded-2xl bg-[var(--sf-bg)] px-3 py-3 text-xs text-[var(--sf-text-primary)] outline-none" /></label><label className="text-[10px] font-bold text-[var(--sf-text-tertiary)]">结束<input type="datetime-local" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} className="mt-1 w-full rounded-2xl bg-[var(--sf-bg)] px-3 py-3 text-xs text-[var(--sf-text-primary)] outline-none" /></label></div>
              <TagSelector value={tags} onChange={setTags} compact />
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="备注（可选）" rows={3} className="w-full resize-none rounded-2xl bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none" />
            </div>
            <BottomActionBar><button type="button" onClick={() => void save()} disabled={saving || (!title.trim() && !taskId) || !startedAt || !endedAt} className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sf-text-primary)] py-3.5 text-xs font-black text-[var(--sf-surface)] disabled:opacity-35">{saving ? <Loader2 size={14} className="animate-spin" /> : <Clock3 size={14} />}保存实际时间</button></BottomActionBar>
          </div>
        </div>
      )}
    </div>
  );
}
