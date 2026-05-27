import { useState, useEffect } from 'react';
import {
  Home, CheckSquare, Calendar as CalendarIcon, Zap,
  Plus, Bell, AlertCircle, LayoutGrid, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { useAppStore } from './store/appStore';
import DashboardView from './components/DashboardView';
import TasksView from './components/TasksView';
import BoardView from './components/BoardView';
import CalendarView from './components/CalendarView';
import SparksView from './components/SparksView';
import DarkFrostedModal from './components/DarkFrostedModal';
import SyncConflictModal from './components/SyncConflictModal';

const navItems = [
  { id: 'dashboard' as const, label: '仪表盘', icon: Home },
  { id: 'tasks' as const, label: '任务', icon: CheckSquare },
  { id: 'board' as const, label: '看板', icon: LayoutGrid },
  { id: 'calendar' as const, label: '日历', icon: CalendarIcon },
  { id: 'sparks' as const, label: '灵感', icon: Zap },
];

function Header({
  onAddClick,
  onSyncClick,
  syncError,
  isSyncing,
  hasLoaded,
}: {
  onAddClick: (context: string) => void;
  onSyncClick: () => void;
  syncError: string | null;
  isSyncing: boolean;
  hasLoaded: boolean;
}) {
  const showBadge = syncError || isSyncing || hasLoaded;

  const badgeContent = (() => {
    if (syncError) {
      return (
        <div
          onClick={onSyncClick}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-500 border border-red-100 cursor-pointer hover:bg-red-100 transition-colors shadow-sm animate-pulse text-xs"
        >
          <AlertCircle size={12} />
          <span className="font-bold tracking-wide">同步异常</span>
        </div>
      );
    }
    if (isSyncing) {
      return (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200 text-xs">
          <RefreshCw size={12} className="animate-spin" />
          <span className="font-bold tracking-wide">同步中</span>
        </div>
      );
    }
    if (hasLoaded) {
      return (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-600 border border-green-100 text-xs">
          <CheckCircle2 size={12} />
          <span className="font-bold tracking-wide">已同步</span>
        </div>
      );
    }
    return null;
  })();

  return (
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-3">
        <div className="text-xl font-black tracking-tighter text-[#242424] italic select-none">
          SparkFlow<span className="text-[#cae393]">.</span>
        </div>
        {showBadge && badgeContent}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onAddClick('task')}
          className="w-9 h-9 rounded-full bg-[#242424] text-white flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={18} />
        </button>
        <button className="w-9 h-9 rounded-full bg-[#e5e2f3] text-[#242424] flex items-center justify-center relative hover:bg-[#d8d4ec] transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#242424] rounded-full border border-white" />
        </button>
      </div>
    </div>
  );
}

function BottomNav({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (tab: 'dashboard' | 'tasks' | 'board' | 'calendar' | 'sparks') => void;
}) {
  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-[#242424] rounded-full px-1.5 py-1.5 flex items-center gap-1 shadow-[0_20px_40px_rgba(0,0,0,0.3)] z-40">
      {navItems.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            className={`relative p-2.5 rounded-full transition-all duration-300 ${
              isActive ? 'bg-white text-[#242424]' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            {isActive && (
              <span className="absolute -top-0.5 right-0 w-2 h-2 bg-[#cae393] rounded-full border-2 border-[#242424]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const tasks = useAppStore((s) => s.tasks);
  const sparks = useAppStore((s) => s.sparks);
  const setSparks = useAppStore((s) => s.setSparks);
  const toggleSubtask = useAppStore((s) => s.toggleSubtask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const deleteSpark = useAppStore((s) => s.deleteSpark);
  const addTask = useAppStore((s) => s.addTask);
  const addSpark = useAppStore((s) => s.addSpark);
  const loadFromApi = useAppStore((s) => s.loadFromApi);
  const syncError = useAppStore((s) => s.syncError);
  const isSyncing = useAppStore((s) => s.isSyncing);
  const hasLoaded = useAppStore((s) => s.hasLoaded);

  useEffect(() => {
    loadFromApi();
  }, [loadFromApi]);

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: 'view' | 'create';
    context: 'task' | 'spark';
    data: any;
  }>({ isOpen: false, mode: 'view', context: 'task', data: null });

  const handleOpenCreate = (context: string) =>
    setModalConfig({ isOpen: true, mode: 'create', context: context as 'task' | 'spark', data: null });

  const handleOpenDetail = (item: any, context: string) =>
    setModalConfig({ isOpen: true, mode: 'view', context: context as 'task' | 'spark', data: item });

  const handleCloseModal = () =>
    setModalConfig((prev) => ({ ...prev, isOpen: false }));

  const handleSaveItem = ({ title, content, context }: { title: string; content: string; context: string }) => {
    const taskColors = ['dark', 'green', 'purple'] as const;
    const sparkColors = ['bg-[#cae393]', 'bg-[#b0a8db]', 'bg-white', 'bg-[#f4f4f4]'];

    if (context === 'task') {
      const newTask = {
        id: String(Date.now()),
        title: title || '未命名任务',
        time: 'Just now',
        status: 'To do' as const,
        priority: 'Medium' as const,
        colorType: taskColors[Math.floor(Math.random() * taskColors.length)],
        comments: 0,
        subtasks: content ? [{ id: String(Date.now() + 1), title: content, completed: false }] : [],
        column: 'personal' as const,
      };
      addTask(newTask);
      setActiveTab('tasks');
    } else {
      const maxZ = Math.max(...sparks.map((s) => s.z), 0) + 1;
      addSpark({
        id: String(Date.now()),
        text: title + (content ? ` — ${content}` : ''),
        color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
        size: 155 + Math.floor(Math.random() * 35),
        pos: { x: 15 + Math.floor(Math.random() * 90), y: 40 + Math.floor(Math.random() * 140) },
        rot: (Math.random() - 0.5) * 6,
        z: maxZ,
      });
      setActiveTab('sparks');
    }
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    toggleSubtask(taskId, subtaskId);
    const t = tasks.find((t) => t.id === taskId);
    if (t) {
      setModalConfig((prev) => ({
        ...prev,
        data: {
          ...t,
          subtasks: t.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, completed: !s.completed } : s
          ),
        },
      }));
    }
  };

  const handleDeleteItem = (id: string, context: string) => {
    if (context === 'task') deleteTask(id);
    else deleteSpark(id);
  };

  return (
    <div className="min-h-screen font-sans bg-black/90 flex justify-center items-center p-2 sm:p-4">
      {/* CSS custom properties injection */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .noise-bg { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E"); }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom-8 { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes zoom-in-95 { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-in { animation-duration: 0.3s; animation-fill-mode: forwards; }
        .fade-in { animation-name: fade-in; }
        .slide-in-from-bottom-8 { animation-name: slide-in-from-bottom-8; }
        .zoom-in-95 { animation-name: zoom-in-95; }
      `}</style>

      {/* Phone frame */}
      <div className="w-full max-w-md h-[92svh] sm:h-[850px] relative shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-[#f4f4f6] overflow-hidden rounded-[2.5rem] border-[6px] border-[#333] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-0 relative z-20">
          <Header
            onAddClick={handleOpenCreate}
            onSyncClick={() => setIsSyncModalOpen(true)}
            syncError={syncError}
            isSyncing={isSyncing}
            hasLoaded={hasLoaded}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar px-5 relative z-10 pb-20">
          {activeTab === 'dashboard' && <DashboardView tasks={tasks} />}
          {activeTab === 'tasks' && <TasksView tasks={tasks} onTaskClick={(t) => handleOpenDetail(t, 'task')} />}
          {activeTab === 'board' && <BoardView tasks={tasks} onTaskClick={(t) => handleOpenDetail(t, 'task')} />}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'sparks' && (
            <SparksView
              sparks={sparks}
              setSparks={setSparks}
              onSparkClick={(s) => handleOpenDetail(s, 'spark')}
              onAddClick={() => handleOpenCreate('spark')}
            />
          )}
        </div>

        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Modals */}
        <DarkFrostedModal
          config={modalConfig}
          onClose={handleCloseModal}
          onSave={handleSaveItem}
          onToggleSubtask={handleToggleSubtask}
          onDelete={handleDeleteItem}
        />
        <SyncConflictModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />
      </div>
    </div>
  );
}

