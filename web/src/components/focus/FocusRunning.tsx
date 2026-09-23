import { Check, Pause, Play, RotateCcw } from 'lucide-react';
import type { PomodoroState } from '../../types';
import GlassSurface from '../ui/GlassSurface';
import { focusMinutes, focusRingProgress, formatFocusTime } from './focusPresentation';

export default function FocusRunning({ state, taskTitle, busy, onRestart, onTogglePause, onComplete }: {
  state: PomodoroState;
  taskTitle: string;
  busy: boolean;
  onRestart: () => void;
  onTogglePause: () => void;
  onComplete: () => void;
}) {
  const progress = focusRingProgress(state);
  return (
    <section className="flex w-full flex-col items-center gap-6 text-center text-white">
      <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sf-purple)]">{state.isPaused ? 'Paused' : 'In focus'}</p><h3 className="mt-1 max-w-xs truncate text-xl font-black">{taskTitle}</h3></div>
      <div className="relative grid h-64 w-64 place-items-center rounded-full shadow-[0_24px_70px_rgba(0,0,0,.28)]" style={{ background: `conic-gradient(var(--sf-marker-purple) ${progress * 360}deg, rgba(176,168,219,.16) 0deg)` }}>
        <div className="grid h-[232px] w-[232px] place-items-center rounded-full bg-[#2b302e] text-white"><div><span className="block text-6xl font-light tabular-nums tracking-tight">{formatFocusTime(state.timeLeft)}</span><span className="mt-2 block text-[10px] uppercase tracking-[0.16em] text-white/40">{state.focusMode === 'countup' ? 'elapsed' : 'remaining'}</span></div></div>
      </div>
      <div className="grid w-full grid-cols-3 gap-2"><div className="rounded-2xl bg-white/[0.07] px-2 py-3"><span className="block text-[9px] text-white/50">有效</span><strong className="text-sm">{focusMinutes(state.effectiveDurationSeconds)}m</strong></div><div className="rounded-2xl bg-white/[0.07] px-2 py-3"><span className="block text-[9px] text-white/50">暂停</span><strong className="text-sm">{focusMinutes(state.pausedDurationSeconds)}m</strong></div><div className="rounded-2xl bg-white/[0.07] px-2 py-3"><span className="block text-[9px] text-white/50">模式</span><strong className="text-sm">{state.focusMode === 'countup' ? '正计时' : '倒计时'}</strong></div></div>
      <GlassSurface variant="control" as="div" className="flex items-center gap-4 rounded-full border-white/10 bg-white/10 p-2">
        <button type="button" disabled={busy} onClick={onRestart} className="grid h-12 w-12 place-items-center rounded-full bg-white/15" aria-label="结束并重新设置"><RotateCcw size={19} /></button>
        <button type="button" disabled={busy} onClick={onTogglePause} className="grid h-16 w-16 place-items-center rounded-full bg-[var(--sf-marker-purple)]" aria-label={state.isPaused ? '继续' : '暂停'}>{state.isPaused ? <Play size={25} fill="currentColor" /> : <Pause size={25} fill="currentColor" />}</button>
        <button type="button" disabled={busy} onClick={onComplete} className="grid h-12 w-12 place-items-center rounded-full bg-[#cae393]" aria-label="完成专注"><Check size={20} /></button>
      </GlassSurface>
      <p className="text-xs text-white/50">{state.isPaused ? '已暂停，准备好后继续' : state.focusMode === 'countup' ? '正计时中，完成时点击勾号' : '保持呼吸，把注意力留在当下'}</p>
    </section>
  );
}
