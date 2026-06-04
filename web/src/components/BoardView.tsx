import { useState, useRef, useEffect, useMemo } from 'react';
import type { Task } from '../store/appStore';
import { useAppStore } from '../store/appStore';
import { resolveMentions } from '../utils/mentionUtils';
import {
  GripVertical, Plus, ChevronDown, ChevronRight,
  FolderPlus, X, Tag, Clock,
} from 'lucide-react';

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
  const [quickFolder, setQuickFolder] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [quickStartTime, setQuickStartTime] = useState('');
  const [quickDuration, setQuickDuration] = useState<number | undefined>(undefined);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [newFolderCol, setNewFolderCol] = useState<'project' | 'personal' | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const folderInputRef = useRef<HTMLInputElement>(null);
  const hasAutoCollapsed = useRef<boolean>(false);
  const [boardFilter, setBoardFilter] = useState<'all' | 'personal' | 'project'>('all');

  const columns = ['project', 'personal'] as const;
  const visibleColumns = boardFilter === 'all'
    ? columns
    : columns.filter((c) => c === boardFilter);
  const quickSection: 'project' | 'personal' = boardFilter === 'project' ? 'project' : 'personal';
  const quickFolderPlaceholder =
    boardFilter === 'project'
      ? '项目名称（可选）'
      : '文件夹名称（可选）';

  const activeTasks = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled');

  useEffect(() => {
    if (newFolderCol && folderInputRef.current) {
      folderInputRef.current.focus();
    }
  }, [newFolderCol]);

  // 首次进入看板时，自动折叠所有没有「In progress」任务的分组
  useEffect(() => {
    if (hasAutoCollapsed.current) return;

    const groups = new Map<string, Task[]>();
    for (const t of activeTasks) {
      const folder = t.project?.trim() || '其他';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder)!.push(t);
    }

    const toCollapse: string[] = [];
    for (const [groupName, groupTasks] of groups) {
      if (groupName === '其他') continue;
      const hasInProgress = groupTasks.some((t) => t.status === 'In progress');
      if (!hasInProgress) {
        toCollapse.push(groupName);
      }
    }

    if (toCollapse.length > 0) {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        for (const g of toCollapse) next.add(g);
        return next;
      });
    }

    hasAutoCollapsed.current = true;
  }, [activeTasks]);

  const handleDragStart = (taskId: string) => {
    setDragTaskId(taskId);
  };

  const handleDrop = (section: 'project' | 'personal') => {
    if (dragTaskId) {
      updateTask(dragTaskId, { section });
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
      section: quickSection,
      project: quickFolder.trim() || undefined,
      startTime: quickStartTime || undefined,
      duration: quickDuration || undefined,
    });
    setQuickTitle('');
    setQuickFolder('');
    setQuickStartTime('');
    setQuickDuration(undefined);
    setShowTimeInput(false);
  };

  const handleCreateFolder = (section: 'project' | 'personal') => {
    if (!newFolderName.trim()) {
      setNewFolderCol(null);
      return;
    }
    // 创建一个空文件夹：添加一个占位任务，用户可以在里面添加真实任务
    const taskColors = ['dark', 'green', 'purple'] as const;
    addTask({
      id: String(Date.now()),
      title: '（新建文件夹）',
      time: 'Just now',
      status: 'To do',
      priority: 'Low',
      colorType: taskColors[Math.floor(Math.random() * taskColors.length)],
      comments: 0,
      subtasks: [],
      section,
      project: newFolderName.trim(),
    });
    setNewFolderName('');
    setNewFolderCol(null);
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  // 按 folder/project 分组，按优先级排序
  const groupByFolder = (colTasks: Task[]) => {
    const groups = new Map<string, Task[]>();
    for (const t of colTasks) {
      const folder = t.project?.trim() || '其他';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder)!.push(t);
    }
    const pOrder = { 'High Priority': 0, 'Medium': 1, 'Low': 2 };
    for (const [, list] of groups) {
      list.sort((a, b) => pOrder[a.priority] - pOrder[b.priority]);
    }
    return groups;
  };

  // 计算每个项目/文件夹的 @回链计数（非本组任务引用了该项目名）
  const backlinkCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of activeTasks) {
      if (!t.description) continue;
      const mentions = t.description.match(/@([^\s@]+)/g);
      if (!mentions) continue;
      const taskProject = t.project?.trim() || '';
      for (const m of mentions) {
        const name = m.slice(1);
        // 排除自己引用自己所在项目
        if (name && name !== taskProject) {
          counts.set(name, (counts.get(name) || 0) + 1);
        }
      }
    }
    return counts;
  }, [activeTasks]);

  return (
    <div className="animate-page-enter">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#242424]">看板</h1>
          <p className="text-xs text-gray-400 mt-0.5">拖拽卡片切换栏目</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-4">
        {([
          { key: 'all', label: '全部' },
          { key: 'personal', label: '个人' },
          { key: 'project', label: '项目' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setBoardFilter(key)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              boardFilter === key
                ? 'bg-[#242424] text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-[#b0a8db]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Quick add */}
      <div className="space-y-2 mb-5">
        <div className="flex gap-2">
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
            placeholder="快速添加任务..."
            className="flex-1 px-4 py-2.5 rounded-full text-sm bg-white border border-gray-100 focus:outline-none focus:border-[#b0a8db] focus:ring-2 focus:ring-[#b0a8db]/20 transition-all placeholder:text-gray-300"
          />
          <button
            onClick={() => setShowFolderInput(!showFolderInput)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              showFolderInput
                ? 'bg-[#b0a8db] text-white'
                : 'bg-white border border-gray-100 text-gray-400 hover:text-[#242424]'
            }`}
            title="指定文件夹"
          >
            <Tag size={16} />
          </button>
          <button
            onClick={() => setShowTimeInput(!showTimeInput)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              showTimeInput
                ? 'bg-[#cae393] text-[#242424]'
                : 'bg-white border border-gray-100 text-gray-400 hover:text-[#242424]'
            }`}
            title="设置时间"
          >
            <Clock size={16} />
          </button>
          <button
            onClick={handleQuickAdd}
            disabled={!quickTitle.trim()}
            className="w-10 h-10 rounded-full bg-[#242424] text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
          >
            <Plus size={18} />
          </button>
        </div>
        {showFolderInput && (
          <div className="flex gap-2 animate-in fade-in">
            <input
              type="text"
              value={quickFolder}
              onChange={(e) => setQuickFolder(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
              placeholder={quickFolderPlaceholder}
              className="flex-1 px-4 py-2 rounded-full text-xs bg-white border border-gray-100 focus:outline-none focus:border-[#b0a8db] transition-all placeholder:text-gray-300"
            />
          </div>
        )}
        {showTimeInput && (
          <div className="flex items-center gap-2 animate-in fade-in">
            <input
              type="time"
              value={quickStartTime}
              onChange={(e) => setQuickStartTime(e.target.value)}
              className="w-28 px-3 py-2 rounded-full text-xs bg-white border border-gray-100 focus:outline-none focus:border-[#cae393] transition-all"
            />
            {[30, 60, 90, 120].map((d) => (
              <button
                key={d}
                onClick={() => setQuickDuration(quickDuration === d ? undefined : d)}
                className={`px-2 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                  quickDuration === d
                    ? 'bg-[#cae393] text-[#242424]'
                    : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'
                }`}
              >
                {d >= 60 ? `${d / 60}h` : `${d}m`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Columns — dynamic grid: 2 cols for all, 1 col for single filter */}
      <div className={`grid gap-3 ${visibleColumns.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {visibleColumns.map((col) => {
          const colTasks = activeTasks.filter((t) => (t.section || 'personal') === col);
          const meta = columnMeta[col];
          const folderGroups = groupByFolder(colTasks);
          const sortedGroups = Array.from(folderGroups.entries()).sort((a, b) => {
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
                dragOverCol === col
                  ? `ring-2 ${col === 'project' ? 'ring-[#b0a8db] bg-[#b0a8db]/5' : 'ring-[#cae393] bg-[#cae393]/5'}`
                  : meta.bg
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                  <h3 className="text-sm font-bold text-[#242424]">{meta.title}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">{colTasks.length}</span>
                  <button
                    onClick={() => setNewFolderCol(col)}
                    className="w-6 h-6 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-gray-400 hover:text-[#242424] transition-all"
                    title="创建文件夹"
                  >
                    <FolderPlus size={12} />
                  </button>
                </div>
              </div>

              {/* 新建文件夹输入 */}
              {newFolderCol === col && (
                <div className="flex gap-2 mb-3 animate-in fade-in">
                  <input
                    ref={folderInputRef}
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder(col);
                      if (e.key === 'Escape') setNewFolderCol(null);
                    }}
                    placeholder={`新建${col === 'project' ? '项目' : '文件夹'}名称...`}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-white border border-gray-100 focus:outline-none focus:border-[#b0a8db] transition-all placeholder:text-gray-300"
                  />
                  <button
                    onClick={() => handleCreateFolder(col)}
                    className="px-2.5 py-1.5 rounded-lg text-xs bg-[#242424] text-white hover:bg-[#333] transition-colors"
                  >
                    创建
                  </button>
                  <button
                    onClick={() => { setNewFolderCol(null); setNewFolderName(''); }}
                    className="px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-[#242424] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="space-y-2.5">
                {sortedGroups.map(([groupName, groupTasks]) => {
                  const isCollapsed = collapsedGroups.has(groupName);
                  const isDefault = groupName === '其他';
                  return (
                    <div
                      key={groupName}
                      className={`rounded-xl overflow-hidden ${
                        isDefault
                          ? ''
                          : 'border border-gray-100/60 bg-white/80 backdrop-blur-sm'
                      }`}
                    >
                      {/* 文件夹/项目标题栏 */}
                      <button
                        onClick={() => toggleGroup(groupName)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors ${
                          isDefault ? 'py-0 mb-2' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {!isDefault && (
                            isCollapsed ? (
                              <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                            )
                          )}
                          <span className={`truncate ${
                            isDefault
                              ? 'text-[10px] text-gray-300 uppercase tracking-wider'
                              : 'text-xs font-bold text-[#242424]'
                          }`}>
                            {isDefault ? '未分组' : groupName}
                          </span>
                        </div>
                        {!isDefault && (
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            {backlinkCounts.get(groupName) ? (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-[#b0a8db]/15 text-[#b0a8db]" title={`${backlinkCounts.get(groupName)} 个任务引用了此项目`}>
                                @{backlinkCounts.get(groupName)}
                              </span>
                            ) : null}
                            <span className="text-[10px] text-gray-400">
                              {groupTasks.length}
                            </span>
                          </div>
                        )}
                      </button>

                      {/* 子任务列表 */}
                      {(!isCollapsed || isDefault) && (
                        <div className={`space-y-1.5 ${isDefault ? '' : 'px-2 pb-2'}`}>
                          {groupTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              allTasks={tasks}
                              dragTaskId={dragTaskId}
                              onDragStart={handleDragStart}
                              onTaskClick={onTaskClick}
                            />
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
  allTasks,
  dragTaskId,
  onDragStart,
  onTaskClick,
}: {
  task: Task;
  allTasks: Task[];
  dragTaskId: string | null;
  onDragStart: (id: string) => void;
  onTaskClick: (task: Task) => void;
}) {
  const mentions = useMemo(() => {
    if (!task.description) return { projectMentions: [] as string[], taskMentions: [] as { id: string; title: string }[] };
    return resolveMentions(
      task.description.match(/@([^\s@]+)/g)?.map((m) => m) ?? [],
      allTasks,
      task.id,
    );
  }, [task.description, allTasks, task.id]);

  const allMentionItems = [
    ...mentions.projectMentions.map((p) => ({ kind: 'project' as const, label: p, id: p })),
    ...mentions.taskMentions.map((t) => ({ kind: 'task' as const, label: t.title, id: t.id })),
  ];
  const visibleItems = allMentionItems.slice(0, 3);
  const overflow = allMentionItems.length - 3;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
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
          {allMentionItems.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mt-1.5 ml-[22px]">
              {visibleItems.map((item) => (
                <span
                  key={item.kind === 'project' ? `p-${item.id}` : `t-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: navigate to board view and highlight group
                  }}
                  className="text-[8px] font-medium px-1.5 py-0.5 rounded-full cursor-pointer transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: item.kind === 'project' ? '#b0a8db33' : '#cae39333',
                    color: item.kind === 'project' ? '#b0a8db' : '#587a1e',
                    border: `1px solid ${item.kind === 'project' ? '#b0a8db55' : '#cae39355'}`,
                  }}
                >
                  @{item.label}
                </span>
              ))}
              {overflow > 0 && (
                <span className="text-[8px] text-gray-400 ml-0.5">+{overflow}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1.5 ml-[22px]">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/5 opacity-70">
              {'待处理'}
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
  );
}
