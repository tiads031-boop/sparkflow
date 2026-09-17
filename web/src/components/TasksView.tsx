import { useState } from 'react';
import type { Task } from '../store/appStore';
import TaskCard from './TaskCard';
import QuadrantView from './QuadrantView';

interface TasksViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export default function TasksView({ tasks, onTaskClick }: TasksViewProps) {
  const [filter, setFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'list' | 'quadrant'>('list');
  const filters = ['All', 'In progress', 'To do', 'Done'];

  const displayTasks =
    filter === 'All'
      ? tasks.filter((t) => t.status !== 'Cancelled')
      : filter === 'In progress'
        ? tasks.filter((t) => t.status === 'In progress' || t.status === 'In review')
        : tasks.filter((t) => t.status === filter);

  const filterLabel = (f: string) =>
    f === 'All' ? '全部' : f === 'In progress' ? '进行中' : f === 'Done' ? '已完成' : '待处理';

  return (
    <div className="animate-page-enter">
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-xl font-bold text-[#242424]">任务列表</h1>
        <span className="text-xs text-gray-400">{tasks.filter((t) => t.status !== 'Cancelled').length} 项</span>
      </div>

      <div className="mb-4 grid grid-cols-2 rounded-full bg-[var(--sf-surface)] p-1 shadow-sm" aria-label="任务视图">
        <button type="button" onClick={() => setViewMode('list')} className={`rounded-full py-2 text-sm font-semibold transition-colors ${viewMode === 'list' ? 'bg-[var(--sf-text-primary)] text-[var(--sf-surface)]' : 'text-[var(--sf-text-secondary)]'}`}>列表</button>
        <button type="button" onClick={() => setViewMode('quadrant')} className={`rounded-full py-2 text-sm font-semibold transition-colors ${viewMode === 'quadrant' ? 'bg-[var(--sf-text-primary)] text-[var(--sf-surface)]' : 'text-[var(--sf-text-secondary)]'}`}>四象限</button>
      </div>

      {/* Filter pills */}
      <div className={`gap-2 overflow-x-auto pb-3 mb-2 hide-scrollbar ${viewMode === 'list' ? 'flex' : 'hidden'}`}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 cursor-pointer px-4 py-2 rounded-full shadow-sm text-sm font-medium transition-colors btn-press ${
              filter === f
                ? 'bg-[#cae393] text-[#242424]'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {filterLabel(f)}
          </button>
        ))}
      </div>

      {viewMode === 'quadrant' ? <QuadrantView tasks={tasks} onTaskClick={onTaskClick} /> : <div className="space-y-1 stagger">
        {displayTasks.length > 0 ? (
          displayTasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))
        ) : (
          <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-3xl border border-dashed border-gray-200">
            暂无{filter === 'All' ? '' : filterLabel(filter)}任务
          </div>
        )}
      </div>}
    </div>
  );
}
