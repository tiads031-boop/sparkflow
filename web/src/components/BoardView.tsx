import { useState } from 'react';
import type { Task } from '../store/appStore';
import { useAppStore } from '../store/appStore';
import { Clock, GripVertical, Plus, ChevronDown, ChevronRight } from 'lucide-react';

interface BoardViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const columnMeta: Record<string, { title: string; color: string; bg: string }> = {
  project: { title: '项目待办', color: '#b0a8db', bg: 'bg-[#b0a8db]/10' },
  personal: { title: '个人待办', color: '#cae393', bg: 'bg-[#cae393]/10' },
};

const priorityBadge = (p: Task['priority']) => {
  if (p === 'High Priority') return { label: 'P0', bg: 'bg-red-500/90', text: 'text-white' };
  if (p === 'Medium') return { label: 'P1', bg: 'bg-yellow-400/90', text: 'text-[#242424]' };
  return { label: 'P2', bg: 'bg-gray-300/90', text: 'text-[#242424]' };
};

export default function BoardView({ tasks, onTaskClick }: BoardViewProps) {
  const updateTask = useAppStore((s) => s.updateTask);
  const addTask = useAppStore((s) => s.addTask);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickColumn, setQuickColumn] = useState<'project' | 'personal'>('personal');
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

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

  const toggleProject = (project: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(project)) next.delete(project);
      else next.add(project);
      return next;
    });
  };

  // 按项目名分组，按优先级排序
  const groupByProject = (colTasks: Task[]) => {
    const groups = new Map<string, Task[]>();
    for (const t of colTasks) {
      const proj = t.project?.trim() || '其他';
      if (!groups.has(proj)) groups.set(proj, []);
      groups.get(proj)!.push(t);
    }
    // 每个组内按优先级排序：P0 > P1 > P2
    const pOrder = { 'High Priority': 0, 'Medium': 1, 'Low': 2 };
    for (const [, list] of groups) {
      list.sort((a, b) => pOrder[a.priority] - pOrder[b.priority]);
    }
    return groups;
  };

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

          // 个人待办列保持原有渲染
          if (col === 'personal') {
            return (
              <div
                key={col}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => handleDrop(col)}
                className={`rounded-2xl p-3 min-h-[200px] transition-all ${
                  dragOverCol === col ? 'ring-2 ring-[#cae393] bg-[#cae393]/5' : meta.bg
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
                    <TaskCard key={task.id} task={task} dragTaskId={dragTaskId} onDragStart={handleDragStart} onTaskClick={onTaskClick} />
                  ))}
                  {colTasks.length === 0 && (
                    <p className="text-center text-xs text-gray-300 py-6">拖拽任务到此处</p>
                  )}
                </div>
              </div>
            );
          }

          // 项目待办列：按项目分组
          const projectGroups = groupByProject(colTasks);
          const sortedProjects = Array.from(projectGroups.entries()).sort((a, b) => {
            // "其他" 放最后
            if (a[0] === '其他') return 1;
            if (b[0] === '其他') return -1;
            return a[0].localeCompare(b[0]);
          });

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

              <div className="space-y-2.5">
                {sortedProjects.map(([project, projTasks]) => {
                  const isCollapsed = collapsedProjects.has(project);
                  const badge = project;
                  return (
                    <div key={project} className="rounded-xl overflow-hidden border border-gray-100/60 bg-white/80 backdrop-blur-sm">
                      {/* 项目标题栏（主任务） */}
                      <button
                        onClick={() => toggleProject(project)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isCollapsed ? (
                            <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                          )}
                          <span className="text-xs font-bold text-[#242424] truncate">{badge}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                          {projTasks.length}
                        </span>
                      </button>

                      {/* 子任务列表 */}
                      {!isCollapsed && (
                        <div className="px-2 pb-2 space-y-1.5">
                          {projTasks.map((task) => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={() => handleDragStart(task.id)}
                              onClick={() => onTaskClick(task)}
                              className={`rounded-lg p-2.5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                                task.colorType === 'dark'
                                  ? 'bg-[#242424] text-white'
                                  : task.colorType === 'green'
                                    ? 'bg-[#cae393] text-[#242424]'
                                    : 'bg-white text-[#242424] border border-gray-100'
                              } ${dragTaskId === task.id ? 'opacity-50 scale-95' : ''}`}
                            >
                              <div className="flex items-start gap-2">
                                <GripVertical size={11} className="mt-0.5 opacity-20 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start gap-1.5 mb-1.5">
                                    <span
                                      className={`text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0 ${
                                        priorityBadge(task.priority).bg
                                      } ${priorityBadge(task.priority).text}`}
                                    >
                                      {priorityBadge(task.priority).label}
                                    </span>
                                    <p className="text-[11px] font-semibold leading-snug mt-0.5">{task.title}</p>
                                  </div>
                                  {task.description && (
                                    <p className="text-[10px] opacity-60 leading-snug ml-[22px]">{task.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1.5 ml-[22px]">
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/5 opacity-70">
                                      {statusLabel(task.status)}
                                    </span>
                                    {task.subtasks.length > 0 && (
                                      <div className="flex items-center gap-1 flex-1">
                                        <div className="flex-1 h-1 rounded-full bg-black/10 overflow-hidden max-w-[60px]">
                                          <div
                                            className="h-full rounded-full bg-current opacity-40"
                                            style={{
                                              width: `${Math.round(
                                                (task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100
                                              )}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="text-[9px] opacity-50">
                                          {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
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

function TaskCard({
  task,
  dragTaskId,
  onDragStart,
  onTaskClick,
}: {
  task: Task;
  dragTaskId: string | null;
  onDragStart: (id: string) => void;
  onTaskClick: (task: Task) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
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
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className={`text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0 ${
                priorityBadge(task.priority).bg
              } ${priorityBadge(task.priority).text}`}
            >
              {priorityBadge(task.priority).label}
            </span>
            <p className="text-xs font-semibold leading-snug">{task.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {task.time && (
              <span className="flex items-center gap-1 text-[10px] opacity-60">
                <Clock size={10} />
                {task.time}
              </span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 opacity-60">
              {'待处理'}
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
      </div>
    </div>
  );
}
