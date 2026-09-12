import { useState } from 'react';
import { Bell, Lock, X } from 'lucide-react';
import type { Task } from '../../types';

export interface ScheduleDraft {
  taskId?: string;
  title: string;
  description?: string;
  scheduledStart: string;
  scheduledEnd: string;
  estimatedMinutes: number;
  reminderAt?: string | null;
  scheduleLocked: boolean;
  scheduleSource: 'manual';
  scheduleColor: string;
}

interface ScheduleEditorProps {
  open: boolean;
  initialDate: Date;
  initialTask?: Task | null;
  onClose: () => void;
  onSave: (draft: ScheduleDraft) => Promise<void>;
}

const colors = ['#b0a8db', '#eeb6c8', '#ead887', '#cae393', '#a9c9ec', '#a9dedc'];
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function ScheduleEditor({ open, initialDate, initialTask, onClose, onSave }: ScheduleEditorProps) {
  const initialStart = initialTask?.scheduledStart ? new Date(initialTask.scheduledStart) : initialDate;
  const [title, setTitle] = useState(initialTask?.title ?? '');
  const [date, setDate] = useState(() => localDate(initialStart));
  const [time, setTime] = useState(() => initialTask?.scheduledStart
    ? initialStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '09:00');
  const [duration, setDuration] = useState(initialTask?.estimatedMinutes ?? initialTask?.duration ?? 60);
  const [locked, setLocked] = useState(initialTask?.scheduleLocked ?? false);
  const [reminder, setReminder] = useState(Boolean(initialTask?.reminderAt));
  const [color, setColor] = useState(initialTask?.scheduleColor ?? colors[0]);
  const [description, setDescription] = useState(initialTask?.description ?? '');
  const [saving, setSaving] = useState(false);
  if (!open) return null;

  const submit = async () => {
    if (!title.trim() || duration < 1) return;
    const start = new Date(`${date}T${time}:00`);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + duration * 60_000);
    setSaving(true);
    try {
      await onSave({
        taskId: initialTask?.id,
        title: title.trim(), description: description.trim(),
        scheduledStart: start.toISOString(), scheduledEnd: end.toISOString(), estimatedMinutes: duration,
        reminderAt: reminder ? start.toISOString() : null,
        scheduleLocked: locked, scheduleSource: 'manual', scheduleColor: color,
      });
      setTitle('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label="安排一件事" onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-t-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">{initialTask ? '编辑安排' : '安排一件事'}</h2><button type="button" onClick={onClose} className="rounded-full bg-[var(--sf-bg)] p-2"><X size={16} /></button></div>
        <div className="space-y-3">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="要做什么？" className="w-full rounded-[var(--sf-radius-sm)] bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none" autoFocus />
          <div className="grid grid-cols-2 gap-2"><label className="text-xs text-[var(--sf-text-secondary)]">日期<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-xl bg-[var(--sf-bg)] p-3 text-sm" /></label><label className="text-xs text-[var(--sf-text-secondary)]">开始<input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1 w-full rounded-xl bg-[var(--sf-bg)] p-3 text-sm" /></label></div>
          <label className="block text-xs text-[var(--sf-text-secondary)]">时长（分钟）<div className="mt-1 flex items-center gap-2"><button type="button" onClick={() => setDuration((value) => Math.max(15, value - 15))} className="h-10 w-10 rounded-full bg-[var(--sf-bg)]">−</button><input type="number" min="1" value={duration} onChange={(event) => setDuration(Math.max(1, Number(event.target.value)))} className="h-10 min-w-0 flex-1 rounded-xl bg-[var(--sf-bg)] text-center text-sm" /><button type="button" onClick={() => setDuration((value) => value + 15)} className="h-10 w-10 rounded-full bg-[var(--sf-bg)]">＋</button></div></label>
          <div className="flex gap-2"><button type="button" onClick={() => setLocked((value) => !value)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl p-3 text-xs ${locked ? 'bg-[var(--sf-marker-purple)]' : 'bg-[var(--sf-bg)]'}`}><Lock size={14} />固定时间</button><button type="button" onClick={() => setReminder((value) => !value)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl p-3 text-xs ${reminder ? 'bg-[var(--sf-marker-green)]' : 'bg-[var(--sf-bg)]'}`}><Bell size={14} />到时提醒</button></div>
          <div className="flex gap-2" aria-label="选择颜色">{colors.map((item) => <button type="button" key={item} onClick={() => setColor(item)} className={`h-8 flex-1 rounded-full ${color === item ? 'ring-2 ring-[var(--sf-text-primary)] ring-offset-2' : ''}`} style={{ backgroundColor: item }} />)}</div>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="备注（可选）" rows={2} className="w-full resize-none rounded-[var(--sf-radius-sm)] bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none" />
          <button type="button" disabled={saving || !title.trim()} onClick={() => void submit()} className="w-full rounded-full bg-[var(--sf-text-primary)] py-3 text-sm font-bold text-[var(--sf-surface)] disabled:opacity-40">{saving ? '保存中…' : initialTask ? '更新安排' : '保存安排'}</button>
        </div>
      </section>
    </div>
  );
}
