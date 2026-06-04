import { useState, useEffect } from 'react';
import {
  Home, CheckSquare, Calendar as CalendarIcon, Zap,
  Plus, Bell, BellOff, LayoutGrid, BookOpen, Settings,
} from 'lucide-react';
import { useAppStore, type Task } from './store/appStore';
import type { ActiveTab, NavOrder, NavVisibility } from './types';
import DashboardView from './components/DashboardView';
import TasksView from './components/TasksView';
import BoardView from './components/BoardView';
import CalendarView from './components/CalendarView';
import SparksView from './components/SparksView';
import CourseView from './components/CourseView';
import CourseDetailView from './components/CourseDetailView';
import SettingsView from './components/SettingsView';
import { importIcs } from './api/courses';
import DarkFrostedModal, { type SaveParams } from './components/DarkFrostedModal';

// ── Capacitor 平台检测（轻量内联，不引入原生模块 import） ──
function isCapacitorNative(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

const navItems = [
  { id: 'dashboard' as const, label: '仪表盘', icon: Home },
  { id: 'tasks' as const, label: '任务', icon: CheckSquare },
  { id: 'board' as const, label: '看板', icon: LayoutGrid },
  { id: 'calendar' as const, label: '日历', icon: CalendarIcon },
  { id: 'courses' as const, label: '课程', icon: BookOpen },
  { id: 'sparks' as const, label: '灵感', icon: Zap },
  { id: 'settings' as const, label: '设置', icon: Settings },
];

type NavItem = (typeof navItems)[number];

function isVisibleNavItem(tab: NavItem, navVisibility: NavVisibility): boolean {
  return tab.id === 'settings' || navVisibility[tab.id];
}

function getOrderedNavItems(navOrder: NavOrder, navVisibility: NavVisibility): NavItem[] {
  const navMap = new Map(navItems.map((item) => [item.id, item]));
  const orderedToggleable = navOrder
    .map((id) => navMap.get(id))
    .filter((item): item is NavItem => !!item && isVisibleNavItem(item, navVisibility));
  const settingsItem = navMap.get('settings');
  return settingsItem ? [...orderedToggleable, settingsItem] : orderedToggleable;
}

function Header({
  onAddClick,
  pushEnabled,
  pushSupported,
  onTogglePush,
}: {
  onAddClick: (context: string) => void;
  pushEnabled: boolean;
  pushSupported: boolean;
  onTogglePush: () => void;
}) {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-3">
        <div className="text-xl font-black tracking-tighter text-[#242424] italic select-none">
          SparkFlow<span className="text-[#cae393]">.</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onAddClick('task')}
          className="w-9 h-9 rounded-full bg-[#242424] text-white flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={18} />
        </button>
        {pushSupported && (
          <button
            onClick={onTogglePush}
            className={`w-9 h-9 rounded-full flex items-center justify-center relative transition-colors ${
              pushEnabled
                ? 'bg-[#cae393] text-[#242424] hover:bg-[#b8d481]'
                : 'bg-[#e5e2f3] text-gray-400 hover:bg-[#d8d4ec]'
            }`}
            title={pushEnabled ? '关闭推送通知' : '开启推送通知'}
          >
            {pushEnabled ? <Bell size={18} /> : <BellOff size={18} />}
            {pushEnabled && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#242424] rounded-full border border-white" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function BottomNav({
  activeTab,
  setActiveTab,
  items,
}: {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  items: readonly NavItem[];
}) {
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bg-[#242424] rounded-full px-1.5 py-1.5 flex items-center gap-1 shadow-[0_20px_40px_rgba(0,0,0,0.3)] z-40"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
    >
      {items.map((tab) => {
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
  const navVisibility = useAppStore((s) => s.navVisibility);
  const navOrder = useAppStore((s) => s.navOrder);
  const tasks = useAppStore((s) => s.tasks);
  const sparks = useAppStore((s) => s.sparks);
  const setSparks = useAppStore((s) => s.setSparks);
  const updateTask = useAppStore((s) => s.updateTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const deleteSpark = useAppStore((s) => s.deleteSpark);
  const addTask = useAppStore((s) => s.addTask);
  const addSpark = useAppStore((s) => s.addSpark);
  const toggleSubtask = useAppStore((s) => s.toggleSubtask);
  const loadTasks = useAppStore((s) => s.loadTasks);
  const loadPomodoroStats = useAppStore((s) => s.loadPomodoroStats);
  const tick = useAppStore((s) => s.tick);
  const pomodoro = useAppStore((s) => s.pomodoro);
  const pushEnabled = useAppStore((s) => s.pushEnabled);
  const pushSupported = useAppStore((s) => s.pushSupported);
  const subscribeToPush = useAppStore((s) => s.subscribeToPush);
  const unsubscribeFromPush = useAppStore((s) => s.unsubscribeFromPush);
  const checkPushStatus = useAppStore((s) => s.checkPushStatus);
  const checkGoogleStatus = useAppStore((s) => s.checkStatus);

  // ── Course 状态 ──
  const loadCourses = useAppStore((s) => s.loadCourses);
  const loadSemesters = useAppStore((s) => s.loadSemesters);
  const loadCourseDetail = useAppStore((s) => s.loadCourseDetail);

  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const visibleNavItems = getOrderedNavItems(navOrder, navVisibility);

  useEffect(() => {
    loadTasks();
    loadPomodoroStats();
    checkPushStatus();
    checkGoogleStatus();
    loadCourses();
    loadSemesters();
  }, [loadTasks, loadPomodoroStats, checkPushStatus, checkGoogleStatus, loadCourses, loadSemesters]);

  // ── Capacitor 生命周期：APP 从后台恢复时刷新关键状态 ──
  useEffect(() => {
    if (!isCapacitorNative()) return;

    // 注册前台推送消息 & 通知点击监听（与注册流程解耦，只挂一次）
    import('./capacitor/push').then((m) => m.listenToPushEvents()).catch(() => {});

    // @capacitor/app 在 PWA 构建时不可用，运行时动态加载
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const handler = await CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            // APP 回到前台：刷新推送状态 & Google 连接状态
            checkPushStatus();
            checkGoogleStatus();
            loadTasks();
          }
        });
        cleanup = handler.remove;
      } catch {
        // Capacitor App 插件不可用，静默降级
      }
    })();

    return () => { cleanup?.(); };
  }, [checkPushStatus, checkGoogleStatus, loadTasks]);

  // 切换到课程 tab 时加载课程数据
  useEffect(() => {
    if (activeTab === 'courses') { loadCourses(); loadSemesters(); }
  }, [activeTab, loadCourses, loadSemesters]);

  useEffect(() => {
    const interval = setInterval(() => tick(), 1000);
    return () => clearInterval(interval);
  }, [tick]);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    context: 'task' | 'spark';
    data: any;
  }>({ isOpen: false, mode: 'create', context: 'task', data: null });
  const [appMessage, setAppMessage] = useState<string | null>(null);

  const handleOpenCreate = (context: string) =>
    setModalConfig({ isOpen: true, mode: 'create', context: context as 'task' | 'spark', data: null });

  const handleOpenDetail = (item: any, context: string) =>
    setModalConfig({ isOpen: true, mode: 'edit', context: context as 'task' | 'spark', data: item });

  const handleCloseModal = () =>
    setModalConfig((prev) => ({ ...prev, isOpen: false }));

  const handleSaveItem = async ({
    id, title, content, context, status, priority, dueDate, section, subtasks, project, startTime, duration,
  }: SaveParams) => {
    const sparkColors = ['bg-[#cae393]', 'bg-[#b0a8db]', 'bg-white', 'bg-[#f4f4f4]'];

    // 将 datetime-local 格式的本地时间转为 UTC ISO 字符串，
    // 避免服务器时区（UTC）误解读导致 8 小时偏移
    const normalizedDueDate = dueDate ? new Date(dueDate).toISOString() : undefined;

    if (context === 'task') {
      const colorType = (
        priority === 'High Priority' ? 'dark' :
        priority === 'Medium' ? 'green' : 'purple'
      ) as Task['colorType'];

      if (id) {
        await updateTask(id, {
          title: title || '未命名任务',
          description: content,
          status: status || 'To do',
          priority: priority || 'Medium',
          colorType,
          section: section || 'personal',
          dueDate: normalizedDueDate || undefined,
          project: project || undefined,
          startTime: startTime || undefined,
          estimatedMinutes: duration,
          ...(subtasks !== undefined ? { subtasks } : {}),
        });
      } else {
        const newTask = {
          id: String(Date.now()),
          title: title || '未命名任务',
          time: 'Just now',
          status: status || 'To do' as const,
          priority: priority || 'Medium' as const,
          colorType,
          comments: 0,
          subtasks: content ? [{ id: String(Date.now() + 1), title: content, completed: false }] : [],
          section: section || 'personal' as const,
          dueDate: normalizedDueDate,
          project: project || undefined,
          startTime: startTime || undefined,
          duration: duration || undefined,
        };
        await addTask(newTask);
        setActiveTab('tasks');
      }
      setAppMessage(null);
    } else {
      if (id) {
        const s = sparks.find((sp) => sp.id === id);
        if (s) {
          setSparks(sparks.map((sp) => sp.id === id ? { ...sp, text: title + (content ? ` — ${content}` : '') } : sp));
        }
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
    }
  };

  const handleDeleteItem = (id: string, context: string) => {
    if (context === 'task') deleteTask(id);
    else deleteSpark(id);
  };

  return (
    <div className="min-h-svh font-sans bg-[#f4f4f6] flex justify-center">
      {/* CSS custom properties injection */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .noise-bg { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E"); }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom-8 { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes zoom-in-95 { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slide-up-sheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-in { animation-duration: 0.3s; animation-fill-mode: forwards; }
        .fade-in { animation-name: fade-in; }
        .slide-in-from-bottom-8 { animation-name: slide-in-from-bottom-8; }
        .zoom-in-95 { animation-name: zoom-in-95; }
        .animate-slide-up-sheet { animation: slide-up-sheet 0.3s cubic-bezier(0.32, 0.72, 0.6, 1) both; }
        .task-block.dragging { box-shadow: 0 12px 40px rgba(0,0,0,0.18); z-index: 50 !important; }
        .task-block:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transition: box-shadow 0.2s; }
        .task-block { transition: box-shadow 0.2s, transform 0.1s; }
        .app-safe-top { padding-top: calc(env(safe-area-inset-top, 0px) + 28px); }
      `}</style>

      {/* App container (removed phone frame, full-screen adaptive) */}
      <div className="w-full h-svh flex flex-col overflow-hidden sm:max-w-lg sm:mx-auto">
        {/* Header */}
        <div className="px-5 pb-0 relative z-20 app-safe-top">
          <Header
            onAddClick={handleOpenCreate}
            pushEnabled={pushEnabled}
            pushSupported={pushSupported}
            onTogglePush={() => pushEnabled ? unsubscribeFromPush() : subscribeToPush()}
          />
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto hide-scrollbar px-5 relative z-10"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
        >
          {appMessage && (
            <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
              {appMessage}
            </div>
          )}
          {/* Course detail view (full page) */}
          {activeTab === 'courses' && viewingCourseId ? (
            <CourseDetailView onBack={() => setViewingCourseId(null)} />
          ) : activeTab === 'dashboard' && <DashboardView tasks={tasks} pomodoro={pomodoro} />}
          {activeTab === 'tasks' && <TasksView tasks={tasks} onTaskClick={(t) => handleOpenDetail(t, 'task')} />}
          {activeTab === 'board' && <BoardView tasks={tasks} onTaskClick={(t) => handleOpenDetail(t, 'task')} />}
          {activeTab === 'calendar' && <CalendarView onTaskClick={(t) => handleOpenDetail(t, 'task')} />}
          {activeTab === 'courses' && !viewingCourseId && (
            <CourseView
              onCourseClick={(courseId) => {
                loadCourseDetail(courseId);
                setViewingCourseId(courseId);
              }}
              onAddClick={() => {}}
              onImportClick={async (file) => {
                try {
                  const result = await importIcs(file);
                  alert(`导入完成：新增 ${result.created.length} 门，更新 ${result.updated.length} 门，共 ${result.eventCount} 次课`);
                  loadCourses();
                } catch (err: any) {
                  alert(`导入失败：${err.message}`);
                }
              }}
            />
          )}
          {activeTab === 'sparks' && (
            <SparksView
              sparks={sparks}
              setSparks={setSparks}
              onSparkClick={(s) => handleOpenDetail(s, 'spark')}
              onAddClick={() => handleOpenCreate('spark')}
            />
          )}
          {activeTab === 'settings' && <SettingsView />}
        </div>

        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} items={visibleNavItems} />

        {/* Modals */}
        <DarkFrostedModal
          config={modalConfig}
          onClose={handleCloseModal}
          onSave={(params) => {
            handleSaveItem(params).catch((err: any) => {
              setAppMessage(err.message || '保存失败，请稍后重试');
            });
          }}
          onDelete={handleDeleteItem}
          onToggleSubtask={toggleSubtask}
        />
      </div>
    </div>
  );
}

