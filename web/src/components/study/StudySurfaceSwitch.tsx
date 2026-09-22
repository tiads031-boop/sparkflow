import { BookOpen, Target } from 'lucide-react';

export type StudySurface = 'goals' | 'courses';

export default function StudySurfaceSwitch({ value, onChange }: {
  value: StudySurface;
  onChange: (value: StudySurface) => void;
}) {
  return (
    <header className="mb-4">
      <div className="mb-3"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--sf-text-tertiary)]">Study</p><h1 className="mt-1 text-2xl font-black text-[var(--sf-text-primary)]">学习</h1></div>
      <div className="grid grid-cols-2 rounded-full bg-[var(--sf-surface)] p-1 shadow-sm" role="group" aria-label="学习内容">
        <button type="button" aria-pressed={value === 'goals'} onClick={() => onChange('goals')} className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-black ${value === 'goals' ? 'bg-[var(--sf-graphite)] text-[#cae393]' : 'text-[var(--sf-text-secondary)]'}`}><Target size={13} />目标</button>
        <button type="button" aria-pressed={value === 'courses'} onClick={() => onChange('courses')} className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-black ${value === 'courses' ? 'bg-[var(--sf-graphite)] text-[#b8d4ee]' : 'text-[var(--sf-text-secondary)]'}`}><BookOpen size={13} />课程</button>
      </div>
    </header>
  );
}
