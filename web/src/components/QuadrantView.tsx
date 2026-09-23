import { useCallback, useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { Task } from '../types';
import { getTaskQuadrant, groupTasksByQuadrant, QUADRANT_META, QUADRANT_ORDER, type TaskQuadrant } from '../utils/taskQuadrants';

function dueLabel(value?: string) {
  if (!value) return '未设截止';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '截止时间异常' : date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function QuadrantPanel({ quadrant, tasks, onTaskClick, onMove, onDropTask, onDragStart, onDragEnd }: {
  quadrant: TaskQuadrant;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onMove: (task: Task, target: TaskQuadrant) => void;
  onDropTask: (taskId: string, target: TaskQuadrant) => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
}) {
  const meta = QUADRANT_META[quadrant];
  return (
    <section
      className="min-w-0 rounded-[var(--sf-radius-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-3 shadow-sm sm:p-4"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropTask(event.dataTransfer.getData('text/task-id'), quadrant);
      }}
    >
      <header className="mb-2 flex items-start justify-between gap-2 sm:mb-3 sm:gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
            <h2 className="text-[11px] font-black leading-tight sm:text-sm">{meta.title}</h2>
          </div>
          <p className="mt-1 hidden text-[11px] text-[var(--sf-text-tertiary)] sm:block">{meta.hint}</p>
        </div>
        <span className="rounded-full bg-[var(--sf-bg)] px-2 py-0.5 text-[9px] font-bold sm:px-2.5 sm:py-1 sm:text-xs">{tasks.length}</span>
      </header>
      <div className="space-y-2">
        {tasks.map((task) => (
          <article
            key={task.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('text/task-id', task.id);
              event.dataTransfer.effectAllowed = 'move';
              onDragStart(task.id);
            }}
            onDragEnd={onDragEnd}
            className="min-w-0 rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] p-2.5 sm:p-3"
          >
            <button type="button" onClick={() => onTaskClick(task)} className="block w-full text-left btn-press focus-ring">
              <strong className="block line-clamp-2 break-words text-xs leading-5 sm:text-sm">{task.title}</strong>
              <span className="mt-1 block truncate text-[10px] text-[var(--sf-text-secondary)] sm:text-[11px]">{task.project || '未分项目'} · {dueLabel(task.dueDate)}</span>
            </button>
            <select
              aria-label={`移动“${task.title}”到其他象限`}
              value={quadrant}
              onChange={(event) => onMove(task, event.target.value as TaskQuadrant)}
              className="mt-2 w-full min-w-0 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] px-2 py-2 text-[11px] text-[var(--sf-text-secondary)] outline-none"
            >
              {QUADRANT_ORDER.map((key) => <option key={key} value={key}>{QUADRANT_META[key].title}</option>)}
            </select>
          </article>
        ))}
        {tasks.length === 0 ? <p className="py-8 text-center text-[9px] text-[var(--sf-text-tertiary)] sm:text-xs">这里暂时是空的</p> : null}
      </div>
    </section>
  );
}

export default function QuadrantView({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (task: Task) => void }) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const updateTask = useAppStore((state) => state.updateTask);
  const groups = useMemo(() => groupTasksByQuadrant(tasks), [tasks]);

  const applyMove = useCallback((task: Task, target: TaskQuadrant) => {
    const important = target === 'important-urgent' || target === 'important-later';
    void updateTask(task.id, {
      quadrant: target,
      priority: important ? 'High Priority' : task.priority === 'High Priority' ? 'Medium' : task.priority,
    });
  }, [updateTask]);

  const requestMove = useCallback((task: Task, target: TaskQuadrant) => {
    const source = getTaskQuadrant(task);
    if (source === target) return;
    applyMove(task, target);
  }, [applyMove]);

  const panelProps = {
    onTaskClick,
    onMove: requestMove,
    onDropTask: (taskId: string, target: TaskQuadrant) => {
      const task = tasks.find((item) => item.id === taskId);
      if (task) requestMove(task, target);
      setDraggedTaskId(null);
    },
    onDragStart: setDraggedTaskId,
    onDragEnd: () => setDraggedTaskId(null),
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 min-[410px]:grid-cols-2 sm:gap-4">
        {QUADRANT_ORDER.map((key) => (
          <QuadrantPanel key={key} quadrant={key} tasks={groups[key]} {...panelProps} />
        ))}
      </div>
      {draggedTaskId ? <p className="mt-3 text-center text-[11px] text-[var(--sf-text-tertiary)]">拖到目标象限即可移动</p> : null}
    </div>
  );
}
