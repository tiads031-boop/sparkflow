import { useMemo, useState } from 'react';
import type { Task } from '../types';
import { groupTasksByQuadrant, QUADRANT_META, QUADRANT_ORDER, type TaskQuadrant } from '../utils/taskQuadrants';

function dueLabel(value?: string) {
  if (!value) return '未设截止';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '截止时间异常' : date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function QuadrantPanel({ quadrant, tasks, onTaskClick }: { quadrant: TaskQuadrant; tasks: Task[]; onTaskClick: (task: Task) => void }) {
  const meta = QUADRANT_META[quadrant];
  return (
    <section className="min-h-64 rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-4 shadow-sm">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
            <h2 className="text-sm font-bold">{meta.title}</h2>
          </div>
          <p className="mt-1 text-[11px] text-[var(--sf-text-tertiary)]">{meta.hint}</p>
        </div>
        <span className="rounded-full bg-[var(--sf-bg)] px-2.5 py-1 text-xs font-semibold">{tasks.length}</span>
      </header>
      <div className="space-y-2">
        {tasks.map((task) => (
          <button
            type="button"
            key={task.id}
            onClick={() => onTaskClick(task)}
            className="w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] p-3 text-left btn-press focus-ring"
          >
            <strong className="block truncate text-sm">{task.title}</strong>
            <span className="mt-1 block text-[11px] text-[var(--sf-text-secondary)]">
              {task.project || '未分项目'} · {dueLabel(task.dueDate)}
            </span>
          </button>
        ))}
        {tasks.length === 0 ? <p className="py-8 text-center text-xs text-[var(--sf-text-tertiary)]">这里暂时是空的</p> : null}
      </div>
    </section>
  );
}

export default function QuadrantView({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (task: Task) => void }) {
  const [active, setActive] = useState<TaskQuadrant>('important-urgent');
  const groups = useMemo(() => groupTasksByQuadrant(tasks), [tasks]);

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:hidden">
        {QUADRANT_ORDER.map((key) => (
          <button
            type="button"
            key={key}
            onClick={() => setActive(key)}
            className={`rounded-2xl px-3 py-2 text-left text-xs transition-colors ${active === key ? 'bg-[var(--sf-text-primary)] text-[var(--sf-surface)]' : 'bg-[var(--sf-surface)]'}`}
          >
            <span className="block font-bold">{QUADRANT_META[key].title}</span>
            <span className="mt-0.5 block opacity-60">{groups[key].length} 项</span>
          </button>
        ))}
      </div>
      <div className="sm:hidden">
        <QuadrantPanel quadrant={active} tasks={groups[active]} onTaskClick={onTaskClick} />
      </div>
      <div className="hidden grid-cols-2 gap-3 sm:grid">
        {QUADRANT_ORDER.map((key) => <QuadrantPanel key={key} quadrant={key} tasks={groups[key]} onTaskClick={onTaskClick} />)}
      </div>
    </div>
  );
}
