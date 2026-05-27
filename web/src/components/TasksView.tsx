import { useState } from 'react';
import type { Task } from '../store/appStore';
import TaskCard from './TaskCard';

interface TasksViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export default function TasksView({ tasks, onTaskClick }: TasksViewProps) {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'In progress', 'In review', 'To do'];

  const displayTasks =
    filter === 'All' ? tasks.filter((t) => t.status !== 'Cancelled') : tasks.filter((t) => t.status === filter);

  const filterLabel = (f: string) =>
    f === 'All' ? '全部' : f === 'In progress' ? '进行中' : f === 'In review' ? '审核中' : '待处理';

  return (
    <div className="animate-page-enter">
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-xl font-bold text-[#242424]">任务列表</h1>
        <span className="text-xs text-gray-400">{tasks.filter((t) => t.status !== 'Cancelled').length} 项</span>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-2 hide-scrollbar">
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

      {/* Task list */}
      <div className="space-y-1 stagger">
        {displayTasks.length > 0 ? (
          displayTasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))
        ) : (
          <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-3xl border border-dashed border-gray-200">
            暂无{filter === 'All' ? '' : filterLabel(filter)}任务
          </div>
        )}
      </div>
    </div>
  );
}
