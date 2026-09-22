import { Play } from 'lucide-react';
import type { PointerEvent } from 'react';
import type { Task } from '../../types';
import GlassSurface from '../ui/GlassSurface';
import { SegmentControl } from '../ui/foundation';
import {
  clampFocusDuration,
  durationFromPointer,
  durationToDegrees,
  MAX_FOCUS_MINUTES,
  MIN_FOCUS_MINUTES,
} from './focusDuration';

export type FocusMode = 'countdown' | 'countup';
const DURATIONS = [25, 45, 60];

function DurationDial({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const update = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onChange(durationFromPointer(event.clientX, event.clientY, rect.left + rect.width / 2, rect.top + rect.height / 2));
  };
  const degrees = durationToDegrees(value);
  return (
    <div className="relative mx-auto h-48 w-48 touch-none select-none rounded-full bg-white/10" style={{ background: `conic-gradient(#cae393 ${degrees}deg, rgba(255,255,255,.10) 0deg)` }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); update(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event); }} role="slider" aria-label="专注时长" aria-valuemin={MIN_FOCUS_MINUTES} aria-valuemax={MAX_FOCUS_MINUTES} aria-valuenow={value} tabIndex={0} onKeyDown={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowRight') onChange(clampFocusDuration(value + 5)); if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') onChange(clampFocusDuration(value - 5)); }}>
      <div className="absolute inset-2 grid place-items-center rounded-full bg-[var(--sf-graphite)]"><div className="text-center"><strong className="block text-5xl font-light tabular-nums text-white">{value}</strong><span className="text-xs text-white/50">分钟</span></div></div>
      <span className="absolute left-1/2 top-1/2 h-[42%] w-0.5 origin-bottom bg-[#cae393]" style={{ transform: `translate(-50%, -100%) rotate(${degrees}deg)` }} aria-hidden="true" />
    </div>
  );
}

export default function FocusSetup({ tasks, taskId, duration, mode, busy, onTaskChange, onDurationChange, onModeChange, onStart }: {
  tasks: Task[];
  taskId: string;
  duration: number;
  mode: FocusMode;
  busy: boolean;
  onTaskChange: (taskId: string) => void;
  onDurationChange: (duration: number) => void;
  onModeChange: (mode: FocusMode) => void;
  onStart: () => void;
}) {
  return (
    <section className="w-full space-y-4">
      <div className="relative overflow-hidden rounded-[2rem] bg-[var(--sf-graphite)] px-5 py-6 shadow-2xl">
        <span className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[#cae393]/20 blur-3xl" />
        <div className="relative">
          <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Choose your rhythm</p>
          <div className="mt-4"><SegmentControl value={mode} onChange={onModeChange} ariaLabel="计时方式" options={[{ value: 'countdown', label: '倒计时' }, { value: 'countup', label: '正计时' }]} /></div>
          <div className="mt-6">{mode === 'countdown' ? <DurationDial value={duration} onChange={onDurationChange} /> : <div className="mx-auto grid h-48 w-48 place-items-center rounded-full border border-white/10 bg-white/[0.04]"><div className="text-center"><strong className="block text-5xl font-light tabular-nums text-white">00:00</strong><span className="mt-2 block text-xs text-white/45">从现在开始累计</span></div></div>}</div>
          {mode === 'countdown' ? <div className="mt-5 flex items-center justify-center gap-2">{DURATIONS.map((minutes) => <button type="button" key={minutes} onClick={() => onDurationChange(minutes)} className={`rounded-full px-4 py-2 text-xs font-black ${duration === minutes ? 'bg-[#cae393] text-[#242424]' : 'bg-white/10 text-white/60'}`}>{minutes}m</button>)}</div> : null}
        </div>
      </div>

      <GlassSurface variant="surface" as="div" className="space-y-3 rounded-[1.7rem] p-4">
        <label className="block text-xs font-bold text-[var(--sf-text-secondary)]">关联任务<select value={taskId} onChange={(event) => onTaskChange(event.target.value)} className="mt-2 w-full rounded-2xl bg-[var(--sf-bg)] px-4 py-3 text-sm font-normal text-[var(--sf-text-primary)] outline-none"><option value="">自由专注，不关联任务</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        {mode === 'countdown' ? <label className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--sf-bg)] px-4 py-2 text-xs font-bold text-[var(--sf-text-secondary)]">精确时长<input type="number" min={MIN_FOCUS_MINUTES} max={MAX_FOCUS_MINUTES} step={1} value={duration} onChange={(event) => onDurationChange(clampFocusDuration(Number(event.target.value)))} className="w-20 bg-transparent py-1 text-right text-sm font-black text-[var(--sf-text-primary)] outline-none" aria-label="精确专注分钟数" /></label> : null}
      </GlassSurface>
      <button type="button" disabled={busy} onClick={onStart} className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sf-graphite)] py-4 font-black text-[#cae393] shadow-lg disabled:opacity-50"><Play size={18} fill="currentColor" />开始专注</button>
    </section>
  );
}
