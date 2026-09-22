import { Check, PenLine } from 'lucide-react';
import type { PomodoroState } from '../../types';
import { focusMinutes } from './focusPresentation';

function formatDateTime(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function FocusCompleted({ state, taskTitle, hasTask, savedRecordCount, onCapture, onFinishTask, onClose }: {
  state: PomodoroState;
  taskTitle?: string;
  hasTask: boolean;
  savedRecordCount: number;
  onCapture: () => void;
  onFinishTask: () => void;
  onClose: () => void;
}) {
  return (
    <section className="w-full space-y-5 text-center">
      <div className="relative mx-auto grid h-28 w-28 place-items-center rounded-full bg-[#cae393] shadow-[0_20px_50px_rgba(142,169,82,.22)]"><Check size={44} /></div>
      <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--sf-marker-green)]">Session complete</p><h3 className="mt-1 text-2xl font-black">完成一次专注</h3><p className="mt-2 text-sm text-[var(--sf-text-secondary)]">{taskTitle || '自由专注'}</p></div>
      <div className="grid grid-cols-2 gap-2"><div className="rounded-[1.5rem] bg-[var(--sf-surface)] p-4"><span className="text-[10px] text-[var(--sf-text-tertiary)]">有效时间</span><strong className="mt-1 block text-2xl font-black">{focusMinutes(state.lastCompletedEffectiveSeconds)}m</strong></div><div className="rounded-[1.5rem] bg-[var(--sf-surface)] p-4"><span className="text-[10px] text-[var(--sf-text-tertiary)]">暂停时间</span><strong className="mt-1 block text-2xl font-black">{focusMinutes(state.pausedDurationSeconds)}m</strong></div></div>
      {state.lastCompletedStartedAt && state.lastCompletedEndedAt ? <p className="text-xs text-[var(--sf-text-tertiary)]">{formatDateTime(state.lastCompletedStartedAt)} – {formatDateTime(state.lastCompletedEndedAt)}</p> : null}
      {state.lastCompletedSessionId ? <button type="button" onClick={onCapture} className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sf-marker-purple)] py-4 font-black"><PenLine size={18} />{savedRecordCount > 0 ? '再记一条' : '记录一下'}</button> : null}
      {savedRecordCount > 0 ? <p className="text-xs text-[var(--sf-text-secondary)]">已保存 {savedRecordCount} 条专注记录</p> : null}
      {hasTask ? <button type="button" onClick={onFinishTask} className="w-full rounded-full bg-[var(--sf-graphite)] py-4 font-black text-[#cae393]">完成关联任务</button> : null}
      <button type="button" onClick={onClose} className="w-full rounded-full bg-[var(--sf-surface)] py-4 font-bold">返回</button>
    </section>
  );
}
