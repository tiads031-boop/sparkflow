import type { Task } from '../store/appStore';
import { Clock, ArrowUpRight } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const isDark = task.colorType === 'dark';
  const bgClass = isDark
    ? 'bg-[#242424] text-white'
    : task.colorType === 'green'
      ? 'bg-[#cae393] text-[#242424]'
      : 'bg-[#b0a8db] text-[#242424]';

  const statusLabel =
    task.status === 'In progress' ? '进行中' :
    task.status === 'In review' ? '审核中' :
    task.status === 'To do' ? '待处理' :
    task.status === 'Done' ? '已完成' : '已取消';

  const priorityLabel =
    task.priority === 'High Priority' ? '高优先级' :
    task.priority === 'Medium' ? '中优先级' : '低优先级';

  return (
    <div
      onClick={onClick}
      className={`relative rounded-[2rem] p-5 mb-4 shadow-sm cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md ${bgClass}`}
    >
      {/* Decorative dot */}
      <div
        className="absolute -bottom-3 left-10 w-6 h-6 bg-[#f4f4f6] rounded-full z-10"
        style={{ boxShadow: 'inset 0 4px 4px rgba(0,0,0,0.05)' }}
      />

      <div className="flex justify-between items-start mb-5">
        <h3 className="font-semibold text-base leading-tight w-3/4">{task.title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium opacity-80">{task.comments} 讨论</span>
          <button
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/50 text-black hover:bg-white'
            }`}
          >
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>

      {/* Subtask progress */}
      {task.subtasks.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-1 rounded-full bg-black/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-current opacity-50"
                style={{
                  width: `${Math.round((task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100)}%`,
                }}
              />
            </div>
            <span className="text-[10px] opacity-60">
              {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center gap-2 text-xs opacity-80">
          <Clock size={13} />
          <span>{task.time || '未设定'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2.5 py-1 rounded-full ${
            isDark ? 'bg-white/10 text-white/70' : 'bg-black/5 text-[#242424]/60'
          }`}>
            {statusLabel}
          </span>
          <div
            className={`px-2.5 py-1 rounded-full border text-[10px] font-medium ${
              isDark ? 'border-white/30' : 'border-black/10'
            }`}
          >
            {priorityLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
