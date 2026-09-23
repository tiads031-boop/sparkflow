import { Check, PenLine } from 'lucide-react';
import type { PomodoroState } from '../../types';
import type { Task } from '../../types';
import { focusMinutes } from './focusPresentation';

function formatDateTime(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function FocusCompleted({ state, taskTitle, hasTask, tasks, title, notes, taskId, busy, savedRecordCount, onTitleChange, onNotesChange, onTaskChange, onSave, onCapture, onFinishTask, onClose }: {
  state: PomodoroState;
  taskTitle?: string;
  hasTask: boolean;
  tasks: Task[];
  title: string;
  notes: string;
  taskId: string;
  busy: boolean;
  savedRecordCount: number;
  onTitleChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onTaskChange: (value: string) => void;
  onSave: () => void;
  onCapture: () => void;
  onFinishTask: () => void;
  onClose: () => void;
}) {
  return (
    <section className="w-full space-y-5 text-center">
      <div className="relative mx-auto grid h-28 w-28 place-items-center rounded-full bg-[#cae393] shadow-[0_20px_50px_rgba(142,169,82,.22)]"><Check size={44} /></div>
      <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--sf-marker-green)]">Session complete</p><h3 className="mt-1 text-2xl font-black">完成一次专注</h3><p className="mt-2 text-sm text-[var(--sf-text-secondary)]">{taskTitle || '自由专注'}</p></div>
      <div className="grid grid-cols-2 gap-2"><div className="rounded-[1.5rem] bg-[var(--sf-surface)] p-4"><span className="text-[10px] text-[var(--sf-text-tertiary)]">有效时间</span><strong className="mt-1 block text-2xl font-black">{focusMinutes(state.lastCompletedEffectiveSeconds)}m</strong></div><div className="rounded-[1.5rem] bg-[var(--sf-surface)] p-4"><span className="text-[10px] text-[var(--sf-text-tertiary)]">暂停时间</span><strong className="mt-1 block text-2xl font-black">{focusMinutes(state.pausedDurationSeconds)}m</strong></div></div>
      <div className="space-y-3 rounded-[1.5rem] bg-[var(--sf-surface)] p-4 text-left">
        <label className="block text-xs font-bold">标题<input value={title} maxLength={120} onChange={(event) => onTitleChange(event.target.value)} placeholder="自由专注" className="mt-1 w-full rounded-xl bg-[var(--sf-bg)] p-3 text-sm font-normal outline-none" /></label>
        <label className="block text-xs font-bold">感想<textarea value={notes} maxLength={2000} onChange={(event) => onNotesChange(event.target.value)} rows={2} placeholder="这次专注有什么收获？" className="mt-1 w-full resize-none rounded-xl bg-[var(--sf-bg)] p-3 text-sm font-normal outline-none" /></label>
        <label className="block text-xs font-bold">关联任务<select value={taskId} onChange={(event) => onTaskChange(event.target.value)} className="mt-1 w-full rounded-xl bg-[var(--sf-bg)] p-3 text-sm font-normal outline-none"><option value="">暂不关联</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        <button type="button" disabled={busy} onClick={onSave} className="w-full rounded-xl bg-[var(--sf-graphite)] py-3 text-xs font-bold text-white disabled:opacity-50">{busy ? '保存中…' : '保存修改'}</button>
      </div>
      {state.lastCompletedStartedAt && state.lastCompletedEndedAt ? <p className="text-xs text-[var(--sf-text-tertiary)]">{formatDateTime(state.lastCompletedStartedAt)} – {formatDateTime(state.lastCompletedEndedAt)}</p> : null}
      {state.lastCompletedSessionId ? <button type="button" onClick={onCapture} className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sf-marker-purple)] py-4 font-black"><PenLine size={18} />{savedRecordCount > 0 ? '再记一条' : '记录一下'}</button> : null}
      {savedRecordCount > 0 ? <p className="text-xs text-[var(--sf-text-secondary)]">已保存 {savedRecordCount} 条专注记录</p> : null}
      {hasTask ? <button type="button" onClick={onFinishTask} className="w-full rounded-full bg-[var(--sf-graphite)] py-4 font-black text-[#cae393]">完成关联任务</button> : null}
      <button type="button" onClick={onClose} className="w-full rounded-full bg-[var(--sf-surface)] py-4 font-bold">返回</button>
    </section>
  );
}
