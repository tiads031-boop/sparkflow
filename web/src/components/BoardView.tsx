import { useState } from 'react';
import type { Task } from '../store/appStore';
import { useAppStore } from '../store/appStore';
import { Clock, Edit2, GripVertical, Plus } from 'lucide-react';

interface BoardViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const columnMeta: Record<string, { title: string; color: string; bg: string }> = {
  project: { title: '项目待办', color: '#b0a8db', bg: 'bg-[#b0a8db]/10' },
  personal: { title: '个人待办', color: '#cae393', bg: 'bg-[#cae393]/10' },
};

export default function BoardView({ tasks, onTaskClick }: BoardViewProps) {
  const updateTask = useAppStore((s) => s.updateTask);
  const addTask = useAppStore((s) => s.addTask);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickColumn, setQuickColumn] = useState<'project' | 'personal'>('personal');
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const columns = ['project', 'personal'] as const;

  const activeTasks = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled');

  const handleDragStart = (taskId: string) => {
    setDragTaskId(taskId);
  };

  const handleDrop = (column: 'project' | 'personal') => {
    if (dragTaskId) {
      updateTask(dragTaskId, { column });
    }
    setDragTaskId(null);
    setDragOverCol(null);
  };

  const handleQuickAdd = () => {
    if (!quickTitle.trim()) return;
    const taskColors = ['dark', 'green', 'purple'] as const;
    addTask({
      id: String(Date.now()),
      title: quickTitle.trim(),
      time: 'Just now',
      status: 'To do',
      priority: 'Medium',
      colorType: taskColors[Math.floor(Math.random() * taskColors.length)],
      comments: 0,
      subtasks: [],
      column: quickColumn,
    });
    setQuickTitle('');
  };

  const statusLabel = (s: string) =>
    s === 'In progress' ? '进行中' : s === 'In review' ? '审核中' : s === 'To do' ? '待处理' : s;

  return (
    <div className="animate-page-enter">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#242424]">看板</h1>
          <p className="text-xs text-gray-400 mt-0.5">拖拽卡片切换栏目</p>
        </div>
      </div>

      {/* Quick add */}
      <div className="flex gap-2 mb-5">
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
          placeholder="快速添加任务..."
          className="flex-1 px-4 py-2.5 rounded-full text-sm bg-white border border-gray-100 focus:outline-none focus:border-[#b0a8db] focus:ring-2 focus:ring-[#b0a8db]/20 transition-all placeholder:text-gray-300"
        />
        <select
          value={quickColumn}
          onChange={(e) => setQuickColumn(e.target.value as 'project' | 'personal')}
          className="px-3 py-2.5 rounded-full text-xs bg-white border border-gray-100 text-[#242424] focus:outline-none"
        >
          <option value="personal">个人</option>
          <option value="project">项目</option>
        </select>
        <button
          onClick={handleQuickAdd}
          disabled={!quickTitle.trim()}
          className="w-10 h-10 rounded-full bg-[#242424] text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-3">
        {columns.map((col) => {
          const colTasks = activeTasks.filter((t) => (t.column || 'personal') === col);
          const meta = columnMeta[col];
          return (
            <div
              key={col}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col)}
              className={`rounded-2xl p-3 min-h-[200px] transition-all ${
                dragOverCol === col ? 'ring-2 ring-[#b0a8db] bg-[#b0a8db]/5' : meta.bg
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                  <h3 className="text-sm font-bold text-[#242424]">{meta.title}</h3>
                </div>
                <span className="text-xs text-gray-400">{colTasks.length}</span>
              </div>

              <div className="space-y-2">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    onClick={() => onTaskClick(task)}
                    className={`rounded-xl p-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      task.colorType === 'dark'
                        ? 'bg-[#242424] text-white'
                        : task.colorType === 'green'
                          ? 'bg-[#cae393] text-[#242424]'
                          : 'bg-white text-[#242424] border border-gray-100'
                    } ${dragTaskId === task.id ? 'opacity-50 scale-95' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical size={12} className="mt-0.5 opacity-30 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-snug mb-2">{task.title}</p>
                        <div className="flex items-center gap-2">
                          {task.time && (
                            <span className="flex items-center gap-1 text-[10px] opacity-60">
                              <Clock size={10} />
                              {task.time}
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 opacity-60">
                            {statusLabel(task.status)}
                          </span>
                        </div>
                        {task.subtasks.length > 0 && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <div className="flex-1 h-1 rounded-full bg-black/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-current opacity-40"
                                style={{
                                  width: `${Math.round(
                                    (task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-[10px] opacity-50">
                              {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full hover:bg-black/10 flex items-center justify-center flex-shrink-0"
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <p className="text-center text-xs text-gray-300 py-6">拖拽任务到此处</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
