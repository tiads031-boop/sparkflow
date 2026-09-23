import { BookOpen, Target } from 'lucide-react';

export type StudySurface = 'goals' | 'courses';

export default function StudySurfaceSwitch({ value, onChange }: {
  value: StudySurface;
  onChange: (value: StudySurface) => void;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div><h1 className="text-[28px] font-black tracking-[-0.04em] text-[var(--sf-text-primary)]">学习</h1><p className="mt-0.5 text-[11px] text-[var(--sf-text-secondary)]">长期目标、阶段和真实投入</p></div>
      <div className="grid shrink-0 grid-cols-2 rounded-2xl border border-[#e2e6e3] bg-[#e9ece9] p-1" role="group" aria-label="学习内容">
        <button type="button" aria-pressed={value === 'goals'} onClick={() => onChange('goals')} className={`flex items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-black ${value === 'goals' ? 'bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-sm' : 'text-[var(--sf-text-secondary)]'}`}><Target size={12} />目标</button>
        <button type="button" aria-pressed={value === 'courses'} onClick={() => onChange('courses')} className={`flex items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-black ${value === 'courses' ? 'bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-sm' : 'text-[var(--sf-text-secondary)]'}`}><BookOpen size={12} />课程</button>
      </div>
    </header>
  );
}
