import type { TaskSection } from '../../types';

export default function TaskSummaryCard({ title, description, section, project, tags, onTitleChange, onDescriptionChange }: {
  title: string;
  description: string;
  section: TaskSection;
  project: string;
  tags: string[];
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.7rem] bg-[var(--sf-graphite)] p-4 text-[var(--sf-bg)] shadow-lg">
      <span className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-[#cae393]/25 blur-2xl" />
      <div className="relative">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/50">Task summary</p>
        <input autoFocus value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="任务标题" aria-label="任务标题" className="mt-2 w-full border-0 bg-transparent text-lg font-black text-white outline-none placeholder:text-white/35" />
        <textarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="补充要求、材料或上下文" aria-label="任务说明" className="mt-2 min-h-14 w-full resize-none border-0 bg-transparent text-xs leading-5 text-white/70 outline-none placeholder:text-white/30" />
        <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-bold text-white/70">
          <span className="rounded-full bg-white/10 px-2.5 py-1">{section}</span>
          {project && <span className="rounded-full bg-white/10 px-2.5 py-1">{project}</span>}
          {tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-[#cae393]/20 px-2.5 py-1 text-[#dcedb8]">#{tag}</span>)}
        </div>
      </div>
    </section>
  );
}
