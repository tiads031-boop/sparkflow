import { useState, useEffect } from 'react';
import {
  Home, CheckSquare, Calendar as CalendarIcon, Zap,
  LayoutGrid, BookOpen, Settings,
} from 'lucide-react';
import { useAppStore, type Task } from './store/appStore';
import type { NavOrder, NavVisibility } from './types';
import DashboardView from './components/DashboardView';
import TasksView from './components/TasksView';
import BoardView from './components/BoardView';
import CalendarView from './components/CalendarView';
import SparksView from './components/SparksView';
import CourseView from './components/CourseView';
import CourseTheme from './components/CourseTheme';
import CourseReminderRuntime from './components/CourseReminderRuntime';
import CourseIntegrationsRuntime from './components/CourseIntegrationsRuntime';
import CourseDetailView from './components/CourseDetailView';
import SettingsView from './components/SettingsView';
import { importIcs } from './api/courses';
import DarkFrostedModal, { type SaveParams } from './components/DarkFrostedModal';
import { normalizeTaskSection } from './utils/taskSections';
import { navigationRegistry } from './navigation';
import AppShell from './components/shell/AppShell';
import QuickAddSheet, { type QuickAddAction } from './components/shell/QuickAddSheet';

// ── Capacitor 平台检测（轻量内联，不引入原生模块 import） ──
function isCapacitorNative(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

const navIconMap = {
  today: Home,
  tasks: CheckSquare,
  board: LayoutGrid,
  timeline: CalendarIcon,
  courses: BookOpen,
  sparks: Zap,
  settings: Settings,
} as const;

function localDateBoundaryToIso(value: string | undefined, boundary: 'start' | 'end'): string | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day, boundary === 'start' ? 0 : 23, boundary === 'start' ? 0 : 59, boundary === 'start' ? 0 : 59, boundary === 'start' ? 0 : 999);
  return date.toISOString();
}

function getOrderedNavItems(navOrder: NavOrder, navVisibility: NavVisibility) {
  const navMap = new Map(navigationRegistry.map((item) => [item.id, item]));
  const orderedToggleable = navOrder
    .map((id) => navMap.get(id))
    .filter((item) => !!item && item.toggleable && navVisibility[item.id as keyof typeof navVisibility])
    .map((item) => ({ id: item!.id, label: item!.label, icon: navIconMap[item!.icon] }));
  const settingsItem = navMap.get('settings');
  return settingsItem
    ? [...orderedToggleable, { id: settingsItem.id, label: settingsItem.label, icon: navIconMap[settingsItem.icon] }]
    : orderedToggleable;
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
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

  const handleQuickAdd = (action: QuickAddAction) => {
    setQuickAddOpen(false);
    if (action === 'spark') {
      handleOpenCreate('spark');
      return;
    }
    if (action === 'schedule') setActiveTab('timeline');
    if (action === 'task' || action === 'schedule') handleOpenCreate('task');
  };

  const handleOpenDetail = (item: any, context: string) =>
    setModalConfig({ isOpen: true, mode: 'edit', context: context as 'task' | 'spark', data: item });

  const handleCloseModal = () =>
    setModalConfig((prev) => ({ ...prev, isOpen: false }));

  const handleSaveItem = async ({
    id, title, content, context, status, priority, dueDate, section, subtasks, project, startTime,
    scheduledStart, reminderAt, repeatRule, repeatStartDate, repeatEndDate, duration,
  }: SaveParams) => {
    const sparkColors = ['bg-[#cae393]', 'bg-[#b0a8db]', 'bg-white', 'bg-[#f4f4f4]'];

    // 将 datetime-local 格式的本地时间转为 UTC ISO 字符串，
    // 避免服务器时区（UTC）误解读导致 8 小时偏移
    const normalizedDueDate = dueDate ? new Date(dueDate).toISOString() : undefined;
    const normalizedScheduledStart = scheduledStart ? new Date(scheduledStart).toISOString() : undefined;
    const normalizedReminderAt = reminderAt ? new Date(reminderAt).toISOString() : undefined;
    const normalizedRepeatStartDate = localDateBoundaryToIso(repeatStartDate, 'start');
    const normalizedRepeatEndDate = localDateBoundaryToIso(repeatEndDate, 'end');

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
          section: normalizeTaskSection(section),
          dueDate: normalizedDueDate || undefined,
          project: project || undefined,
          startTime: startTime || undefined,
          scheduledStart: normalizedScheduledStart,
          reminderAt: normalizedReminderAt,
          repeatRule: repeatRule || undefined,
          repeatStartDate: normalizedRepeatStartDate,
          repeatEndDate: normalizedRepeatEndDate,
          estimatedMinutes: duration,
          ...(subtasks !== undefined ? { subtasks } : {}),
        } as Partial<Task>);
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
          section: normalizeTaskSection(section),
          dueDate: normalizedDueDate,
          project: project || undefined,
          startTime: startTime || undefined,
          scheduledStart: normalizedScheduledStart,
          reminderAt: normalizedReminderAt,
          repeatRule: repeatRule || undefined,
          repeatStartDate: normalizedRepeatStartDate,
          repeatEndDate: normalizedRepeatEndDate,
          duration: duration || undefined,
        } as Task;
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
    <AppShell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      navItems={visibleNavItems}
      onQuickAdd={() => setQuickAddOpen(true)}
      pushEnabled={pushEnabled}
      pushSupported={pushSupported}
      onTogglePush={() => pushEnabled ? unsubscribeFromPush() : subscribeToPush()}
    >
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

          {appMessage && (
            <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
              {appMessage}
            </div>
          )}
          <CourseReminderRuntime />
          <CourseIntegrationsRuntime />
          {/* Course detail view (full page) */}
          {activeTab === 'courses' && viewingCourseId ? (
            <CourseTheme><CourseDetailView onBack={() => setViewingCourseId(null)} /></CourseTheme>
          ) : activeTab === 'today' && <DashboardView tasks={tasks} pomodoro={pomodoro} />}
          {activeTab === 'tasks' && <TasksView tasks={tasks} onTaskClick={(t) => handleOpenDetail(t, 'task')} />}
          {activeTab === 'board' && <BoardView tasks={tasks} onTaskClick={(t) => handleOpenDetail(t, 'task')} />}
          {activeTab === 'timeline' && <CalendarView onTaskClick={(t) => handleOpenDetail(t, 'task')} />}
          {activeTab === 'courses' && !viewingCourseId && (
            <CourseTheme>
            <CourseView
              onCourseClick={(courseId) => {
                loadCourseDetail(courseId);
                setViewingCourseId(courseId);
              }}
              onAddClick={() => {}}
              onImportClick={async (file) => {
                try {
                  const result = await importIcs(file, undefined, { semesterId: useAppStore.getState().activeSemesterId || undefined });
                  alert(`导入完成：新增 ${result.created.length} 门，更新 ${result.updated.length} 门，共 ${result.eventCount} 次课`);
                  loadCourses();
                } catch (err: any) {
                  alert(`导入失败：${err.message}`);
                }
              }}
            />
            </CourseTheme>
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
        <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onSelect={handleQuickAdd} />
    </AppShell>
  );
}
