import { Clock3, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import {
  createManualActualTime,
  updateFocusActualTime,
  updateManualActualTime,
  type ActualTimelineEntry,
} from '../../api/actualTimeline';
import type { Task } from '../../types';
import TagSelector from '../tags/TagSelector';
import { BottomActionBar } from '../ui/foundation';
import { useModalLifecycle } from '../ui/useModalLifecycle';

export interface ActualEditorRange {
  start: string;
  end: string;
}

function localInputValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function ActualEditorSheet({ entry, range, tasks, onClose, onSaved }: {
  entry?: ActualTimelineEntry | null;
  range: ActualEditorRange;
  tasks: Task[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(() => entry?.title || '');
  const [taskId, setTaskId] = useState(() => entry?.taskId || '');
  const [startedAt, setStartedAt] = useState(() => localInputValue(entry?.start || range.start));
  const [endedAt, setEndedAt] = useState(() => localInputValue(entry?.end || range.end));
  const [notes, setNotes] = useState(() => entry?.notes || '');
  const [tags, setTags] = useState<string[]>(() => entry?.tags || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useModalLifecycle(true, onClose);

  const save = async () => {
    if ((!title.trim() && !taskId) || saving) return;
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    if ((!entry || entry.source === 'manual') && (!startedAt || !endedAt || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)) {
      setError('结束时间必须晚于开始时间');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const values = {
        title: title.trim() || undefined,
        taskId: taskId || undefined,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        notes: notes.trim() || undefined,
        tags,
      };
      if (entry?.source === 'focus') {
        await updateFocusActualTime(entry.id, { title: title.trim(), notes: notes.trim(), taskId: taskId || null, tags });
      } else if (entry) {
        await updateManualActualTime(entry.id, { ...values, taskId: taskId || null, expectedRevision: entry.revision });
      } else {
        await createManualActualTime({ ...values, clientRequestId: crypto.randomUUID() });
      }
      onSaved();
      onClose();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '保存实际时间失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/35 sm:items-center" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={entry ? '编辑实际时间' : '补记实际时间'} className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-[var(--sf-surface)] p-5 shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-start justify-between gap-3">
          <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--sf-text-tertiary)]">{entry?.source === 'focus' ? 'Focus' : 'Manual actual'}</p><h2 className="mt-1 text-xl font-black">{entry?.source === 'focus' ? '编辑专注记录' : entry ? '编辑实际时间' : '补记实际时间'}</h2></div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--sf-bg)]" aria-label="关闭"><X size={15} /></button>
        </header>
        <div className="mt-5 space-y-3">
          <label className="block text-[10px] font-bold text-[var(--sf-text-secondary)]">做了什么<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="选择任务后可不填" className="mt-1.5 w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none" /></label>
          <label className="block text-[10px] font-bold text-[var(--sf-text-secondary)]">关联任务<select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none"><option value="">不关联任务</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
          {entry?.source !== 'focus' && <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-bold text-[var(--sf-text-secondary)]">开始<input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-3 text-xs outline-none" /></label>
            <label className="text-[10px] font-bold text-[var(--sf-text-secondary)]">结束<input type="datetime-local" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-3 text-xs outline-none" /></label>
          </div>}
          <TagSelector value={tags} onChange={setTags} compact />
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="备注（可选）" rows={3} className="w-full resize-none rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none" />
        </div>
        {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
        <BottomActionBar><button type="button" onClick={() => void save()} disabled={saving || (!title.trim() && !taskId) || !startedAt || !endedAt} className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sf-graphite)] py-3.5 text-xs font-black text-[var(--sf-bg)] disabled:opacity-35">{saving ? <Loader2 size={14} className="animate-spin" /> : <Clock3 size={14} />}{entry ? '保存修改' : '保存实际时间'}</button></BottomActionBar>
      </section>
    </div>
  );
}
