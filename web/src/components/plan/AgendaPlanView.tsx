import CalendarView from '../CalendarView';
import type { Task } from '../../types';

export default function AgendaPlanView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] bg-[var(--sf-surface)] shadow-sm">
      <div className="border-b border-black/5 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sf-text-tertiary)]">Agenda</p>
        <h2 className="text-base font-black text-[var(--sf-text-primary)]">日程视图</h2>
      </div>
      <div className="px-3 pt-3">
        <CalendarView onTaskClick={onTaskClick} />
      </div>
    </section>
  );
}
