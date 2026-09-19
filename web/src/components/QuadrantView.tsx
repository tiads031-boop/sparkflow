import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store/appStore';
import type { Task } from '../types';
import { getTaskQuadrant, groupTasksByQuadrant, QUADRANT_META, QUADRANT_ORDER, type TaskQuadrant } from '../utils/taskQuadrants';
import { useModalLifecycle } from './ui/useModalLifecycle';

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
      className="min-h-[220px] overflow-hidden rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-2.5 shadow-sm sm:min-h-64 sm:p-4"
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
      <div className="max-h-[34svh] space-y-1.5 overflow-y-auto pr-0.5 sm:max-h-none sm:space-y-2 sm:overflow-visible">
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
            className="rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg)] p-2 sm:rounded-2xl sm:p-3"
          >
            <button type="button" onClick={() => onTaskClick(task)} className="block w-full text-left btn-press focus-ring">
              <strong className="block line-clamp-2 text-[10px] leading-4 sm:text-sm">{task.title}</strong>
              <span className="mt-1 block truncate text-[8px] text-[var(--sf-text-secondary)] sm:text-[11px]">{task.project || '未分项目'} · {dueLabel(task.dueDate)}</span>
            </button>
            <select
              aria-label={`移动“${task.title}”到其他象限`}
              value={quadrant}
              onChange={(event) => onMove(task, event.target.value as TaskQuadrant)}
              className="mt-1.5 w-full rounded-full bg-[var(--sf-surface)] px-1.5 py-1 text-[8px] text-[var(--sf-text-secondary)] outline-none sm:mt-2 sm:px-2 sm:text-[11px]"
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
  const [pendingMove, setPendingMove] = useState<{ task: Task; target: TaskQuadrant; date: string } | null>(null);
  const updateTask = useAppStore((state) => state.updateTask);
  const groups = useMemo(() => groupTasksByQuadrant(tasks), [tasks]);
  const closeMoveDialog = useCallback(() => setPendingMove(null), []);
  useModalLifecycle(Boolean(pendingMove), closeMoveDialog);

  const applyMove = useCallback((task: Task, target: TaskQuadrant, dueDate?: string) => {
    const important = target === 'important-urgent' || target === 'important-later';
    void updateTask(task.id, {
      priority: important ? 'High Priority' : task.priority === 'High Priority' ? 'Medium' : task.priority,
      ...(dueDate ? { dueDate: new Date(`${dueDate}T23:59:00`).toISOString() } : {}),
    });
  }, [updateTask]);

  const requestMove = useCallback((task: Task, target: TaskQuadrant) => {
    const source = getTaskQuadrant(task);
    if (source === target) return;
    const sourceUrgent = source === 'important-urgent' || source === 'urgent';
    const targetUrgent = target === 'important-urgent' || target === 'urgent';
    if (sourceUrgent !== targetUrgent) {
      const date = new Date();
      date.setDate(date.getDate() + (targetUrgent ? 1 : 7));
      const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      setPendingMove({ task, target, date: localDate });
      return;
    }
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
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {QUADRANT_ORDER.map((key) => (
          <QuadrantPanel key={key} quadrant={key} tasks={groups[key]} {...panelProps} />
        ))}
      </div>
      {draggedTaskId ? <p className="mt-3 text-center text-[11px] text-[var(--sf-text-tertiary)]">拖到目标象限即可移动</p> : null}
      {pendingMove ? createPortal(
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/35" onPointerDown={(event) => { if (event.target === event.currentTarget) closeMoveDialog(); }}>
          <section role="dialog" aria-modal="true" aria-label="调整任务截止日期" className="w-full max-w-lg rounded-t-[2rem] bg-[var(--sf-surface)] p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]">
            <h2 className="text-lg font-bold">移动到“{QUADRANT_META[pendingMove.target].title}”</h2>
            <p className="mt-1 text-sm text-[var(--sf-text-secondary)]">跨越紧急程度时需要确认新的截止日期，避免系统替你猜测。</p>
            <label className="mt-5 block text-sm font-medium">新的截止日期
              <input type="date" value={pendingMove.date} onChange={(event) => setPendingMove((value) => value ? { ...value, date: event.target.value } : null)} className="mt-2 w-full rounded-2xl bg-[var(--sf-bg)] px-4 py-3 outline-none" />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={closeMoveDialog} className="rounded-full bg-[var(--sf-bg)] py-3 font-semibold">取消</button>
              <button type="button" onClick={() => { applyMove(pendingMove.task, pendingMove.target, pendingMove.date); closeMoveDialog(); }} className="rounded-full bg-[var(--sf-text-primary)] py-3 font-semibold text-[var(--sf-surface)]">确认移动</button>
            </div>
          </section>
        </div>, document.body) : null}
    </div>
  );
}
