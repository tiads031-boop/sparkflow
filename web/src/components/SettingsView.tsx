import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Calendar,
  Check,
  ChevronRight,
  Cloud,
  Clock3,
  Database,
  Download,
  Grid2X2,
  Info,
  Loader2,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  Tag as TagIcon,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { SparkFlowProfession, SparkFlowStatusNeed } from '../store/appStore';
import { apiRequest } from '../api/client';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../api/push';
import { exportSparkflowData, readSparkflowImportFile } from '../utils/dataPortability';
import {
  presetTaskSections,
  readCustomTaskSections,
  writeCustomTaskSections,
} from '../utils/taskSections';
import {
  applyAppearancePreference,
  readUserPreferences,
  updateUserPreferences,
  type AppearancePreference,
  type UserPreferences,
} from '../utils/userPreferences';
import {
  checkCalendarPermission,
  exportTasksToSystemCalendar,
  importLocalCalendarEvents,
  isSystemCalendarAvailable,
  requestCalendarPermission,
} from '../capacitor/calendar';
import CourseWebDavBackup from './CourseWebDavBackup';
import TagManagementView from './tags/TagManagementView';
import TimeTrackingSettingsView from './profile/TimeTrackingSettingsView';

type SettingsPage =
  | 'home'
  | 'appearance'
  | 'task'
  | 'tags'
  | 'timeTracking'
  | 'notifications'
  | 'connections'
  | 'data'
  | 'security'
  | 'about';

interface SyncScope {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

const defaultScopes: SyncScope[] = [
  { key: 'tasks', label: '任务事件', description: '有开始时间和截止日期的任务', enabled: true },
  { key: 'courses', label: '课程事件', description: '课程表中安排的课程时间', enabled: true },
  { key: 'manual', label: '手动日程', description: '日历中手动创建的日程', enabled: true },
  { key: 'sparks', label: '记录', description: '随手记默认不同步到日历', enabled: false },
];

const professionLabels: Record<SparkFlowProfession, string> = {
  student: '学生',
  work: '工作 / 实习',
  developer: '开发',
  research: '科研',
  creator: '创作',
  other: '其他',
};

const statusLabels: Record<SparkFlowStatusNeed, string> = {
  'study-focus': '学习专注',
  'internship-work': '工作推进',
  'dev-research': '开发 / 科研',
  'project-shipping': '项目交付',
  'life-balance': '生活平衡',
};

function relativeTime(isoStr: string | null): string {
  if (!isoStr) return '从未同步';
  const diffMs = Date.now() - new Date(isoStr).getTime();
  if (diffMs < 0) return '刚刚';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec} 秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(isoStr).toLocaleDateString('zh-CN');
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const TIME_ZONE_OPTIONS = [
  { value: 'Asia/Shanghai', label: '中国标准时间（Asia/Shanghai）' },
  { value: 'Asia/Tokyo', label: '日本标准时间（Asia/Tokyo）' },
  { value: 'America/Los_Angeles', label: '美国太平洋时间（America/Los_Angeles）' },
  { value: 'UTC', label: '协调世界时（UTC）' },
] as const;

function PageHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <header className="mb-5 flex items-start gap-3">
      <button
        type="button"
        onClick={onBack}
        className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-sm"
        aria-label="返回"
      >
        <ArrowLeft size={17} />
      </button>
      <div className="min-w-0">
        <h1 className="text-xl font-black text-[var(--sf-text-primary)]">{title}</h1>
        {subtitle && <p className="mt-1 text-xs leading-5 text-[var(--sf-text-tertiary)]">{subtitle}</p>}
      </div>
    </header>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sf-text-tertiary)]">
        {title}
      </h2>
      <div className="overflow-hidden rounded-[1.6rem] border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-sm">{children}</div>
    </section>
  );
}

function SettingRow({
  icon,
  title,
  description,
  value,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  value?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick || disabled}
      className="flex w-full items-center gap-3 border-b border-[var(--sf-divider)] px-4 py-3.5 text-left last:border-b-0 disabled:cursor-default"
      style={{ minHeight: 'var(--sf-row-min-height)' }}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[var(--sf-bg)] text-[var(--sf-text-primary)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-bold text-[var(--sf-text-primary)]">{title}</strong>
        {description && <span className="mt-0.5 block text-[10px] leading-4 text-[var(--sf-text-tertiary)]">{description}</span>}
      </span>
      {value && <span className="max-w-[38%] truncate text-xs font-medium text-[var(--sf-text-tertiary)]">{value}</span>}
      {onClick && !disabled && <ChevronRight size={16} className="shrink-0 text-[var(--sf-text-tertiary)] opacity-60" />}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f7bd8]/50 disabled:opacity-40 ${checked ? 'bg-[#242424]' : 'bg-gray-200'}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

function InlineCard({ children }: { children: ReactNode }) {
  return <div className="rounded-[1.6rem] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 shadow-sm">{children}</div>;
}

export default function SettingsView() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const tasks = useAppStore((s) => s.tasks);
  const sparks = useAppStore((s) => s.sparks);
  const events = useAppStore((s) => s.events);
  const setSparks = useAppStore((s) => s.setSparks);
  const setEvents = useAppStore((s) => s.setEvents);
  const addTask = useAppStore((s) => s.addTask);
  const loadTasks = useAppStore((s) => s.loadTasks);

  const isConnected = useAppStore((s) => s.isConnected);
  const googleEmail = useAppStore((s) => s.googleEmail);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const syncedCount = useAppStore((s) => s.syncedCount);
  const isConnecting = useAppStore((s) => s.isConnecting);
  const isSyncing = useAppStore((s) => s.isSyncing);
  const error = useAppStore((s) => s.error);
  const connectGoogle = useAppStore((s) => s.connectGoogle);
  const disconnectGoogle = useAppStore((s) => s.disconnectGoogle);
  const syncNow = useAppStore((s) => s.syncNow);
  const clearError = useAppStore((s) => s.clearError);

  const pushEnabled = useAppStore((s) => s.pushEnabled);
  const pushSupported = useAppStore((s) => s.pushSupported);
  const pushChannel = useAppStore((s) => s.pushChannel);
  const subscribeToPush = useAppStore((s) => s.subscribeToPush);
  const unsubscribeFromPush = useAppStore((s) => s.unsubscribeFromPush);
  const checkPushStatus = useAppStore((s) => s.checkPushStatus);

  const navVisibility = useAppStore((s) => s.navVisibility);
  const navOrder = useAppStore((s) => s.navOrder);
  const displayName = useAppStore((s) => s.displayName);
  const professions = useAppStore((s) => s.professions);
  const statusNeeds = useAppStore((s) => s.statusNeeds);
  const changePassword = useAppStore((s) => s.changePassword);
  const logout = useAppStore((s) => s.logout);
  const todayFocusCount = useAppStore((s) => s.pomodoro.todayCount);
  const totalFocusMinutes = useAppStore((s) => s.pomodoro.totalFocusMinutes);

  const [page, setPage] = useState<SettingsPage>('home');
  const [preferences, setPreferences] = useState<UserPreferences>(() => readUserPreferences());
  const [scopes, setScopes] = useState<SyncScope[]>(defaultScopes);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const [hasLocalPermission, setHasLocalPermission] = useState(false);
  const [isLocalBusy, setIsLocalBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [customTaskSections, setCustomTaskSections] = useState<string[]>(() => readCustomTaskSections());
  const [newTaskSection, setNewTaskSection] = useState('');

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);

  const canUseSystemCalendar = isSystemCalendarAvailable();

  useEffect(() => {
    if (!canUseSystemCalendar) return;
    checkCalendarPermission().then(setHasLocalPermission).catch(() => setHasLocalPermission(false));
  }, [canUseSystemCalendar]);

  useEffect(() => {
    writeCustomTaskSections(customTaskSections);
  }, [customTaskSections]);

  useEffect(() => {
    if (page !== 'notifications') return;
    let active = true;
    const timeoutId = window.setTimeout(() => {
      setNotificationLoading(true);
      setPushMessage(null);

      void Promise.all([
        checkPushStatus(),
        getNotificationPreferences(),
      ])
        .then(async ([, serverPreferences]) => {
          if (!active) return;
          setNotificationPreferences(serverPreferences);
          const nextLocal = updateUserPreferences({
            defaultReminderMinutes: serverPreferences.defaultReminderMinutes,
          });
          setPreferences(nextLocal);
        })
        .catch((err) => {
          if (active) setPushMessage(errorMessage(err, '读取通知偏好失败'));
        })
        .finally(() => {
          if (active) setNotificationLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [page, checkPushStatus]);

  const savePreferences = (patch: Partial<UserPreferences>) => {
    const next = updateUserPreferences(patch);
    setPreferences(next);
    if (patch.appearance !== undefined) {
      applyAppearancePreference(next.appearance);
    }
  };

  const saveNotificationPreference = async (
    patch: Partial<NotificationPreferences>,
  ) => {
    if (notificationSaving) return;
    setNotificationSaving(true);
    setPushMessage(null);
    try {
      const next = await updateNotificationPreferences(patch);
      setNotificationPreferences(next);
      if (patch.defaultReminderMinutes !== undefined) {
        const nextLocal = updateUserPreferences({
          defaultReminderMinutes: next.defaultReminderMinutes,
        });
        setPreferences(nextLocal);
      }
    } catch (err) {
      setPushMessage(errorMessage(err, '保存通知偏好失败'));
    } finally {
      setNotificationSaving(false);
    }
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushMessage(null);
    try {
      if (enabled) await subscribeToPush();
      else await unsubscribeFromPush();
      await checkPushStatus();
    } catch (err) {
      setPushMessage(errorMessage(err, '通知设置失败'));
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    setPushMessage(null);
    try {
      const res = await apiRequest('/push/test', { method: 'POST' });
      const result = await res.json();
      setPushMessage(result.ok ? '测试通知已发送，请检查当前设备。' : (result.reason || '测试通知发送失败'));
    } catch (err) {
      setPushMessage(errorMessage(err, '测试通知发送失败'));
    } finally {
      setPushBusy(false);
    }
  };

  const toggleScope = (key: string) => {
    setScopes((prev) => prev.map((scope) => (
      scope.key === key ? { ...scope, enabled: !scope.enabled } : scope
    )));
  };

  const handleSyncNow = async () => {
    await syncNow();
    await loadTasks();
  };

  const handleRequestLocalPermission = async () => {
    setIsLocalBusy(true);
    setLocalMessage(null);
    try {
      const granted = await requestCalendarPermission();
      setHasLocalPermission(granted);
      setLocalMessage(granted ? '已获得系统日历读写权限' : '未获得系统日历权限');
    } finally {
      setIsLocalBusy(false);
    }
  };

  const handleImportLocal = async () => {
    setIsLocalBusy(true);
    setLocalMessage(null);
    try {
      const result = await importLocalCalendarEvents();
      await loadTasks();
      const count = result.eventCount ?? result.importedCount ?? result.imported ?? result.created ?? 0;
      setHasLocalPermission(true);
      setLocalMessage(`已导入近期本地日历事件：${count} 个`);
    } catch (err) {
      setLocalMessage(errorMessage(err, '导入本地日历失败'));
    } finally {
      setIsLocalBusy(false);
    }
  };

  const handleExportLocal = async () => {
    setIsLocalBusy(true);
    setLocalMessage(null);
    try {
      const result = await exportTasksToSystemCalendar(tasks);
      setHasLocalPermission(true);
      setLocalMessage(`已写入系统日历：${result.created} 个，失败 ${result.failed} 个`);
    } catch (err) {
      setLocalMessage(errorMessage(err, '写入系统日历失败'));
    } finally {
      setIsLocalBusy(false);
    }
  };

  const handleExportData = () => {
    try {
      exportSparkflowData({
        tasks,
        sparks,
        events,
        profile: { displayName, professions, statusNeeds },
        preferences: { navVisibility, navOrder, customTaskSections },
      });
      setMigrationMessage(`已导出 ${tasks.length} 个任务、${sparks.length} 条记录、${events.length} 个日程`);
    } catch (err) {
      setMigrationMessage(errorMessage(err, '导出失败，请稍后再试'));
    }
  };

  const handleImportData = async (file: File | null) => {
    if (!file) return;
    setIsImporting(true);
    setMigrationMessage(null);
    try {
      const imported = await readSparkflowImportFile(file);
      let persistedTasks = 0;
      for (const task of imported.tasks) {
        await addTask({ ...task, id: `${Date.now()}-${persistedTasks}` });
        persistedTasks += 1;
      }
      if (imported.tasks.length > 0) await loadTasks();
      setSparks(imported.sparks);
      if (imported.events.length > 0) setEvents(imported.events);
      if (imported.preferences?.customTaskSections) {
        setCustomTaskSections(imported.preferences.customTaskSections);
      }
      setMigrationMessage(
        `已写入 ${persistedTasks} 个任务、导入 ${imported.sparks.length} 条记录${imported.events.length > 0 ? `、${imported.events.length} 个日程` : ''}。`,
      );
    } catch (err) {
      setMigrationMessage(errorMessage(err, '导入失败，请检查 JSON 文件'));
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleAddTaskSection = () => {
    const name = newTaskSection.trim();
    if (!name) return;
    const reserved = presetTaskSections.some((section) => section.label === name || section.key === name);
    const duplicated = customTaskSections.some((section) => section.toLowerCase() === name.toLowerCase());
    if (reserved || duplicated) {
      setMigrationMessage('该分组已存在');
      return;
    }
    setCustomTaskSections((prev) => [...prev, name]);
    setNewTaskSection('');
  };

  const handleDeleteTaskSection = (name: string) => {
    setCustomTaskSections((prev) => prev.filter((section) => section !== name));
  };

  const handleChangePassword = async () => {
    setPasswordMessage(null);
    setPasswordError(null);
    if (newPassword.length < 6) {
      setPasswordError('新密码至少需要 6 个字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    setIsChangingPassword(true);
    try {
      const success = await changePassword(oldPassword, newPassword);
      if (success) {
        setPasswordMessage('密码已修改');
        setShowChangePassword(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError('旧密码不正确');
      }
    } catch {
      setPasswordError('修改失败，请稍后再试');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (page === 'appearance') {
    const appearanceOptions: Array<{
      id: AppearancePreference;
      title: string;
      description: string;
      icon: ReactNode;
    }> = [
      {
        id: 'system',
        title: '跟随系统',
        description: '自动跟随设备的浅色 / 深色外观。',
        icon: <Monitor size={18} />,
      },
      {
        id: 'light',
        title: '浅色',
        description: '始终使用明亮、清晰的 SparkFlow 界面。',
        icon: <Sun size={18} />,
      },
      {
        id: 'dark',
        title: '深色',
        description: '降低夜间亮度，使用深色 Token。',
        icon: <Moon size={18} />,
      },
    ];

    return (
      <div className="animate-page-enter pb-24">
        <PageHeader
          title="外观"
          subtitle="选择界面明暗模式；不影响任务、课程或账户数据。"
          onBack={() => setPage('home')}
        />

        <div className="mb-4 overflow-hidden rounded-[1.9rem] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 shadow-sm">
          <div className="rounded-[1.5rem] bg-[var(--sf-bg)] p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[var(--sf-surface)] text-[var(--sf-text-primary)]">
                <Palette size={17} />
              </span>
              <div>
                <p className="text-sm font-black text-[var(--sf-text-primary)]">SparkFlow 外观预览</p>
                <p className="mt-0.5 text-[10px] text-[var(--sf-text-tertiary)]">
                  当前：{preferences.appearance === 'system' ? '跟随系统' : preferences.appearance === 'dark' ? '深色' : '浅色'}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <div className="rounded-2xl bg-[var(--sf-surface)] px-3 py-3">
                <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-[var(--sf-text-tertiary)]">Today</span>
                <strong className="mt-1 block text-xs text-[var(--sf-text-primary)]">14:00 · 完成重点任务</strong>
              </div>
              <span className="grid h-full min-h-14 w-14 place-items-center rounded-2xl bg-[var(--sf-marker-green)] text-[#242424]">
                <Check size={17} />
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {appearanceOptions.map((option) => {
            const selected = preferences.appearance === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => savePreferences({ appearance: option.id })}
                className={`flex w-full items-center gap-3 rounded-[1.5rem] border px-4 py-4 text-left transition ${
                  selected
                    ? 'border-[var(--sf-text-primary)] bg-[var(--sf-surface)]'
                    : 'border-[var(--sf-border)] bg-[var(--sf-surface)]'
                }`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                  selected
                    ? 'bg-[var(--sf-text-primary)] text-[var(--sf-surface)]'
                    : 'bg-[var(--sf-bg)] text-[var(--sf-text-secondary)]'
                }`}>
                  {option.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm font-black text-[var(--sf-text-primary)]">{option.title}</strong>
                  <span className="mt-0.5 block text-[10px] leading-4 text-[var(--sf-text-tertiary)]">{option.description}</span>
                </span>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                  selected
                    ? 'border-[var(--sf-text-primary)] bg-[var(--sf-text-primary)] text-[var(--sf-surface)]'
                    : 'border-[var(--sf-border)]'
                }`}>
                  {selected && <Check size={12} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 space-y-4">
          <Group title="界面密度">
            <div className="grid grid-cols-2 gap-2 p-3" role="group" aria-label="界面密度">
              {([
                { id: 'comfortable', label: '舒适', detail: '留白更充足' },
                { id: 'compact', label: '紧凑', detail: '同屏显示更多' },
              ] as const).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={preferences.density === option.id}
                  onClick={() => savePreferences({ density: option.id })}
                  className={`rounded-2xl border px-3 py-3 text-left ${preferences.density === option.id ? 'border-[var(--sf-text-primary)] bg-[var(--sf-bg)]' : 'border-[var(--sf-border)]'}`}
                >
                  <strong className="block text-xs text-[var(--sf-text-primary)]">{option.label}</strong>
                  <span className="mt-1 block text-[10px] text-[var(--sf-text-tertiary)]">{option.detail}</span>
                </button>
              ))}
            </div>
          </Group>

          <Group title="动态效果">
            <div className="flex items-center gap-3 px-4 py-3.5" style={{ minHeight: 'var(--sf-row-min-height)' }}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[var(--sf-bg)] text-[var(--sf-text-primary)]">
                <SlidersHorizontal size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-bold text-[var(--sf-text-primary)]">减少动态</strong>
                <span className="mt-0.5 block text-[10px] leading-4 text-[var(--sf-text-tertiary)]">关闭页面入场与玻璃材质化动画。</span>
              </span>
              <Toggle checked={preferences.reduceMotion} onChange={(reduceMotion) => savePreferences({ reduceMotion })} />
            </div>
          </Group>
        </div>
      </div>
    );
  }

  if (page === 'task') {
    return (
      <div className="animate-page-enter pb-24">
        <PageHeader title="计划与任务" subtitle="决定待办如何组织和显示。" onBack={() => setPage('home')} />

        <InlineCard>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eef6dc]">
              <Grid2X2 size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#242424]">启用四象限模式</p>
              <p className="mt-0.5 text-[10px] leading-4 text-gray-400">开启后，Plan → 待办可在列表与完整 2×2 四象限之间切换。</p>
            </div>
            <Toggle
              checked={preferences.quadrantEnabled}
              onChange={(quadrantEnabled) => savePreferences({ quadrantEnabled })}
            />
          </div>
        </InlineCard>

        <section className="mt-5">
          <h2 className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">待办分组</h2>
          <InlineCard>
            <div className="mb-4 flex flex-wrap gap-2">
              {presetTaskSections.map((section) => (
                <span key={section.key} className="rounded-full bg-[#f4f4f6] px-3 py-1.5 text-xs font-medium text-gray-500">
                  {section.shortLabel}
                </span>
              ))}
            </div>
            <div className="mb-3 flex gap-2">
              <input
                value={newTaskSection}
                onChange={(event) => setNewTaskSection(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleAddTaskSection()}
                placeholder="添加自定义分组"
                className="min-w-0 flex-1 rounded-full bg-[#f4f4f6] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#cae393]/40"
              />
              <button
                type="button"
                onClick={handleAddTaskSection}
                disabled={!newTaskSection.trim()}
                className="grid h-10 w-10 place-items-center rounded-full bg-[#242424] text-white disabled:opacity-30"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {customTaskSections.map((section) => (
                <div key={section} className="flex items-center justify-between rounded-2xl bg-[#f4f4f6] px-3 py-2.5">
                  <span className="truncate text-sm font-medium">{section}</span>
                  <button type="button" onClick={() => handleDeleteTaskSection(section)} className="grid h-8 w-8 place-items-center rounded-full bg-white text-gray-400" aria-label="删除分组">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {customTaskSections.length === 0 && <p className="py-3 text-center text-xs text-gray-400">暂无自定义分组</p>}
            </div>
          </InlineCard>
        </section>
      </div>
    );
  }

  if (page === 'tags') {
    return <TagManagementView onBack={() => setPage('home')} />;
  }

  if (page === 'timeTracking') {
    return <TimeTrackingSettingsView onBack={() => setPage('home')} onOpenActual={() => setActiveTab('timeline')} />;
  }

  if (page === 'notifications') {
    const serverPreferences = notificationPreferences;
    return (
      <div className="animate-page-enter pb-24">
        <PageHeader
          title="通知与提醒"
          subtitle="任务、课程和安静时段由账户偏好统一管理，PWA 与 Android 共用。"
          onBack={() => setPage('home')}
        />

        <InlineCard>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eef6dc]">
              <Bell size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#242424]">当前设备通知</p>
              <p className="mt-0.5 text-[10px] text-gray-400">
                {!pushSupported
                  ? '当前环境不支持推送'
                  : pushEnabled
                    ? `已开启 · ${pushChannel === 'fcm' ? 'Android FCM' : 'Web Push'}`
                    : '未开启'}
              </p>
            </div>
            <Toggle
              checked={pushEnabled}
              disabled={!pushSupported || pushBusy}
              onChange={(next) => void handlePushToggle(next)}
            />
          </div>

          <div className="mt-4 border-t border-black/[0.05] pt-4">
            <button
              type="button"
              disabled={!pushEnabled || pushBusy}
              onClick={() => void handleTestPush()}
              className="w-full rounded-full bg-[#242424] py-2.5 text-sm font-bold text-[#cae393] disabled:opacity-35"
            >
              {pushBusy ? '处理中…' : '发送测试通知'}
            </button>
            <p className="mt-2 text-[10px] leading-4 text-gray-400">
              测试通知是主动诊断操作，即使当前处于安静时段也会发送。
            </p>
            {pushMessage && (
              <p className="mt-3 rounded-2xl bg-[#f4f4f6] px-3 py-2.5 text-xs text-gray-600">
                {pushMessage}
              </p>
            )}
          </div>
        </InlineCard>

        {notificationLoading || !serverPreferences ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-[1.6rem] bg-white py-10 text-xs text-gray-400 shadow-sm">
            <Loader2 size={14} className="animate-spin" /> 正在读取账户通知偏好…
          </div>
        ) : (
          <>
            <section className="mt-5">
              <h2 className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                提醒类型
              </h2>
              <InlineCard>
                <div className="flex items-center gap-3 border-b border-black/[0.05] pb-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#242424]">任务提醒</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-gray-400">
                      使用任务自己的 reminderAt；没有单独提醒时可按默认提前时间推导。
                    </p>
                  </div>
                  <Toggle
                    checked={serverPreferences.taskRemindersEnabled}
                    disabled={notificationSaving}
                    onChange={(taskRemindersEnabled) =>
                      void saveNotificationPreference({ taskRemindersEnabled })}
                  />
                </div>

                <div className="border-b border-black/[0.05] py-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#242424]">截止时间兜底提醒</p>
                      <p className="mt-0.5 text-[10px] leading-4 text-gray-400">
                        任务没有 reminderAt 时，仍根据下面的默认提前量提醒。
                      </p>
                    </div>
                    <Toggle
                      checked={serverPreferences.dueSoonFallbackEnabled}
                      disabled={notificationSaving || !serverPreferences.taskRemindersEnabled}
                      onChange={(dueSoonFallbackEnabled) =>
                        void saveNotificationPreference({ dueSoonFallbackEnabled })}
                    />
                  </div>

                  <label className="mt-3 block">
                    <span className="text-xs font-bold text-gray-500">默认提前提醒</span>
                    <select
                      value={serverPreferences.defaultReminderMinutes}
                      disabled={notificationSaving || !serverPreferences.taskRemindersEnabled}
                      onChange={(event) =>
                        void saveNotificationPreference({
                          defaultReminderMinutes: Number(event.target.value),
                        })}
                      className="mt-2 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm font-medium outline-none disabled:opacity-50"
                    >
                      <option value={0}>到截止时间时</option>
                      <option value={10}>提前 10 分钟</option>
                      <option value={15}>提前 15 分钟</option>
                      <option value={30}>提前 30 分钟</option>
                      <option value={60}>提前 1 小时</option>
                      <option value={120}>提前 2 小时</option>
                      <option value={1440}>提前 1 天</option>
                    </select>
                    <span className="mt-1.5 block text-[10px] leading-4 text-gray-400">
                      Task Sheet 会同步使用这项账户偏好；具体任务仍可以单独改 reminderAt。
                    </span>
                  </label>
                </div>

                <div className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#242424]">课程提醒</p>
                      <p className="mt-0.5 text-[10px] leading-4 text-gray-400">
                        只提醒真实 Course occurrence；停课 override 不会发送。
                      </p>
                    </div>
                    <Toggle
                      checked={serverPreferences.courseRemindersEnabled}
                      disabled={notificationSaving}
                      onChange={(courseRemindersEnabled) =>
                        void saveNotificationPreference({ courseRemindersEnabled })}
                    />
                  </div>

                  <label className="mt-3 block">
                    <span className="text-xs font-bold text-gray-500">课程提前提醒</span>
                    <select
                      value={serverPreferences.courseReminderMinutes}
                      disabled={notificationSaving || !serverPreferences.courseRemindersEnabled}
                      onChange={(event) =>
                        void saveNotificationPreference({
                          courseReminderMinutes: Number(event.target.value),
                        })}
                      className="mt-2 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm font-medium outline-none disabled:opacity-50"
                    >
                      <option value={0}>上课时</option>
                      <option value={5}>提前 5 分钟</option>
                      <option value={10}>提前 10 分钟</option>
                      <option value={15}>提前 15 分钟</option>
                      <option value={30}>提前 30 分钟</option>
                      <option value={60}>提前 1 小时</option>
                      <option value={120}>提前 2 小时</option>
                    </select>
                  </label>
                </div>
              </InlineCard>
            </section>

            <section className="mt-5">
              <h2 className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                安静时段
              </h2>
              <InlineCard>
                <label className="block border-b border-black/[0.05] pb-4">
                  <span className="text-sm font-bold text-[#242424]">账户时区</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-gray-400">
                    用于“今天/明天”、课程冲突、回顾日期和账户提醒；不会随当前浏览器自动改变。
                  </span>
                  <select
                    aria-label="账户时区"
                    value={serverPreferences.timeZone}
                    disabled={notificationSaving}
                    onChange={(event) =>
                      void saveNotificationPreference({ timeZone: event.target.value })}
                    className="mt-2 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm font-medium outline-none disabled:opacity-50"
                  >
                    {!TIME_ZONE_OPTIONS.some((option) => option.value === serverPreferences.timeZone) && (
                      <option value={serverPreferences.timeZone}>{serverPreferences.timeZone}</option>
                    )}
                    {TIME_ZONE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#242424]">启用安静时段</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-gray-400">
                      期间不会发送自动任务或课程提醒；测试通知不受影响。
                    </p>
                  </div>
                  <Toggle
                    checked={serverPreferences.quietHoursEnabled}
                    disabled={notificationSaving}
                    onChange={(quietHoursEnabled) =>
                      void saveNotificationPreference({ quietHoursEnabled })}
                  />
                </div>

                {serverPreferences.quietHoursEnabled && (
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-black/[0.05] pt-4">
                    <label className="block">
                      <span className="text-[10px] font-bold text-gray-500">开始</span>
                      <input
                        type="time"
                        value={serverPreferences.quietStart}
                        disabled={notificationSaving}
                        onChange={(event) =>
                          void saveNotificationPreference({ quietStart: event.target.value })}
                        className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-3 py-3 text-sm outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold text-gray-500">结束</span>
                      <input
                        type="time"
                        value={serverPreferences.quietEnd}
                        disabled={notificationSaving}
                        onChange={(event) =>
                          void saveNotificationPreference({ quietEnd: event.target.value })}
                        className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-3 py-3 text-sm outline-none"
                      />
                    </label>
                  </div>
                )}

                <p className="mt-3 rounded-2xl bg-[#f4f4f6] px-3 py-2.5 text-[10px] leading-4 text-gray-500">
                  当前时区：{serverPreferences.timeZone}。跨午夜的安静时段（如 23:00–07:00）会自动正确处理。
                </p>
              </InlineCard>
            </section>

            <div className="mt-4 rounded-2xl border border-dashed border-[#b0a8db]/50 bg-[#f4f2fb] px-4 py-3">
              <p className="text-xs font-bold text-[#4f4675]">通知偏好已跨设备</p>
              <p className="mt-1 text-[10px] leading-4 text-[#6d638e]">
                这些偏好保存到账户，不再只依赖浏览器本地设置。每日摘要、学习计划提醒与冲突提醒会在有真实服务端触发器后再开放，不展示无效开关。
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  if (page === 'connections') {
    return (
      <div className="animate-page-enter pb-24">
        <PageHeader title="连接与同步" subtitle="管理 Google Calendar 与 Android 系统日历。" onBack={() => setPage('home')} />

        <section className="space-y-4">
          <InlineCard>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#eef6dc]"><Calendar size={16} /></span>
              <div>
                <h2 className="text-sm font-bold">Google Calendar</h2>
                <p className="text-[10px] text-gray-400">{isConnected ? `已连接 · ${googleEmail || 'Google 账号'}` : '未连接'}</p>
              </div>
            </div>

            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span className="flex-1">{error}</span>
                <button type="button" onClick={clearError}>关闭</button>
              </div>
            )}

            {!isConnected ? (
              <button
                type="button"
                onClick={connectGoogle}
                disabled={isConnecting}
                className="w-full rounded-full bg-[#242424] py-3 text-sm font-bold text-[#cae393] disabled:opacity-50"
              >
                {isConnecting ? '正在连接…' : '连接 Google 日历'}
              </button>
            ) : (
              <>
                <div className="mb-3 rounded-2xl bg-[#f4f4f6] px-4 py-3 text-xs text-gray-500">
                  <p>上次同步：{relativeTime(lastSyncAt)}</p>
                  <p className="mt-1">已同步：{syncedCount} 个事件</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void handleSyncNow()} disabled={isSyncing} className="rounded-full bg-[#cae393] py-2.5 text-xs font-bold disabled:opacity-50">
                    {isSyncing ? '同步中…' : '立即同步'}
                  </button>
                  {!showDisconnectConfirm ? (
                    <button type="button" onClick={() => setShowDisconnectConfirm(true)} className="rounded-full bg-[#f4f4f6] py-2.5 text-xs font-bold text-gray-500">
                      断开连接
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { disconnectGoogle(); setShowDisconnectConfirm(false); }}
                      className="rounded-full bg-red-500 py-2.5 text-xs font-bold text-white"
                    >
                      确认断开
                    </button>
                  )}
                </div>
              </>
            )}

            <div className="mt-4 border-t border-black/[0.05] pt-4">
              <p className="mb-2 text-xs font-bold">同步范围</p>
              <div className="space-y-1">
                {scopes.map((scope) => (
                  <button
                    type="button"
                    key={scope.key}
                    onClick={() => toggleScope(scope.key)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-[#f4f4f6]"
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${scope.enabled ? 'border-[#cae393] bg-[#cae393]' : 'border-gray-300'}`}>
                      {scope.enabled && <Check size={11} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold">{scope.label}</span>
                      <span className="block truncate text-[10px] text-gray-400">{scope.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </InlineCard>

          <InlineCard>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#f4f2fb]"><Smartphone size={16} /></span>
              <div>
                <h2 className="text-sm font-bold">Android 系统日历</h2>
                <p className="text-[10px] text-gray-400">App 内可读取或写入本地日历</p>
              </div>
            </div>

            {!canUseSystemCalendar ? (
              <p className="rounded-2xl bg-[#f4f4f6] px-4 py-3 text-xs leading-5 text-gray-500">
                当前 Web/PWA 环境不能直接访问系统日历。Android App 中会显示授权和导入/写入操作。
              </p>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2 rounded-2xl bg-[#f4f4f6] px-3 py-2.5 text-xs text-gray-500">
                  <ShieldCheck size={14} className={hasLocalPermission ? 'text-green-600' : 'text-gray-400'} />
                  {hasLocalPermission ? '已获得系统日历权限' : '尚未获得系统日历权限'}
                </div>
                {localMessage && <p className="mb-3 rounded-2xl bg-[#eef6dc] px-3 py-2.5 text-xs">{localMessage}</p>}
                <div className="space-y-2">
                  <button type="button" onClick={() => void handleRequestLocalPermission()} disabled={isLocalBusy} className="w-full rounded-full bg-[#242424] py-2.5 text-xs font-bold text-white disabled:opacity-50">
                    授权系统日历
                  </button>
                  <button type="button" onClick={() => void handleImportLocal()} disabled={isLocalBusy} className="w-full rounded-full bg-[#cae393] py-2.5 text-xs font-bold disabled:opacity-50">
                    导入近期本地事件
                  </button>
                  <button type="button" onClick={() => void handleExportLocal()} disabled={isLocalBusy} className="w-full rounded-full bg-[#f4f4f6] py-2.5 text-xs font-bold text-gray-600 disabled:opacity-50">
                    写入 SparkFlow 日程
                  </button>
                </div>
              </>
            )}
          </InlineCard>
        </section>
      </div>
    );
  }

  if (page === 'data') {
    return (
      <div className="animate-page-enter pb-24">
        <PageHeader title="数据与备份" subtitle="导入、导出和管理课程备份。" onBack={() => setPage('home')} />
        <InlineCard>
          <div className="mb-4">
            <h2 className="text-sm font-bold">SparkFlow JSON</h2>
            <p className="mt-1 text-[10px] leading-4 text-gray-400">导出任务、记录、日程和兼容偏好；导入会把任务写入当前账户。</p>
          </div>
          {migrationMessage && <p className="mb-3 rounded-2xl bg-[#eef6dc] px-3 py-2.5 text-xs">{migrationMessage}</p>}
          <div className="space-y-2">
            <button type="button" onClick={handleExportData} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#242424] py-2.5 text-sm font-bold text-[#cae393]">
              <Download size={14} /> 导出 JSON
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void handleImportData(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#f4f4f6] py-2.5 text-sm font-bold text-gray-600 disabled:opacity-50"
            >
              {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              导入 JSON
            </button>
          </div>
          <CourseWebDavBackup />
        </InlineCard>
      </div>
    );
  }

  if (page === 'security') {
    return (
      <div className="animate-page-enter pb-24">
        <PageHeader title="账户与安全" subtitle="当前账号、密码和退出登录。" onBack={() => setPage('home')} />

        <InlineCard>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#242424] text-lg font-black text-[#cae393]">
              {(displayName || 'S').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{displayName || 'SparkFlow 用户'}</p>
              <p className="mt-0.5 text-[10px] text-gray-400">
                {[...professions.map((item) => professionLabels[item]), ...statusNeeds.map((item) => statusLabels[item])].join(' · ') || '未设置画像'}
              </p>
            </div>
          </div>

          {passwordMessage && <p className="mb-3 rounded-2xl bg-[#eef6dc] px-3 py-2.5 text-xs">{passwordMessage}</p>}

          <button
            type="button"
            onClick={() => {
              setShowChangePassword((value) => !value);
              setPasswordError(null);
              setOldPassword('');
              setNewPassword('');
              setConfirmPassword('');
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#f4f4f6] py-2.5 text-sm font-bold text-gray-600"
          >
            <Lock size={14} /> 修改密码
          </button>

          {showChangePassword && (
            <div className="mt-3 space-y-2 rounded-2xl bg-[#f4f4f6]/70 p-3">
              <input type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} placeholder="当前密码" className="w-full rounded-full bg-white px-4 py-2.5 text-sm outline-none" />
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="新密码（至少 6 位）" className="w-full rounded-full bg-white px-4 py-2.5 text-sm outline-none" />
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="确认新密码" className="w-full rounded-full bg-white px-4 py-2.5 text-sm outline-none" />
              {passwordError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{passwordError}</p>}
              <button type="button" onClick={() => void handleChangePassword()} disabled={isChangingPassword} className="w-full rounded-full bg-[#242424] py-2.5 text-sm font-bold text-[#cae393] disabled:opacity-50">
                {isChangingPassword ? '修改中…' : '确认修改'}
              </button>
            </div>
          )}

          <button type="button" onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-red-50 py-2.5 text-sm font-bold text-red-600">
            <LogOut size={14} /> 退出登录
          </button>
        </InlineCard>
      </div>
    );
  }

  if (page === 'about') {
    return (
      <div className="animate-page-enter pb-24">
        <PageHeader title="关于与诊断" subtitle="版本信息与当前运行能力。" onBack={() => setPage('home')} />
        <InlineCard>
          <div className="space-y-1">
            <div className="flex items-center justify-between border-b border-black/[0.04] py-3">
              <span className="text-sm text-gray-500">版本</span>
              <span className="text-sm font-bold">v1.0</span>
            </div>
            <div className="flex items-center justify-between border-b border-black/[0.04] py-3">
              <span className="text-sm text-gray-500">技术栈</span>
              <span className="text-xs font-medium text-gray-400">React · NestJS · PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">推送通道</span>
              <span className="text-xs font-bold text-gray-500">{pushEnabled ? pushChannel.toUpperCase() : '未启用'}</span>
            </div>
          </div>
        </InlineCard>
      </div>
    );
  }

  return (
    <div className="animate-page-enter pb-24">
      <header className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sf-text-tertiary)]">SparkFlow</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-black tracking-[-0.04em] text-[var(--sf-text-primary)]">我的</h1>
            <p className="mt-1 text-xs text-[var(--sf-text-tertiary)]">偏好、连接、数据和账户都在这里。</p>
          </div>
          <span className="rounded-full bg-[var(--sf-surface)] px-3 py-1.5 text-[9px] font-bold text-[var(--sf-text-secondary)] shadow-sm">
            {preferences.appearance === 'system' ? '系统外观' : preferences.appearance === 'dark' ? '深色' : '浅色'}
          </span>
        </div>
      </header>

      <button
        type="button"
        onClick={() => setPage('security')}
        className="mb-3 w-full overflow-hidden rounded-[2rem] bg-[#242424] p-5 text-left shadow-sm"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#cae393] text-xl font-black text-[#242424]">
            {(displayName || 'S').slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#cae393]">Account</span>
            <strong className="mt-0.5 block truncate text-lg font-black text-white">{displayName || 'SparkFlow 用户'}</strong>
            <span className="mt-1 block truncate text-[10px] text-white/50">
              {[...professions.map((item) => professionLabels[item]), ...statusNeeds.map((item) => statusLabels[item])].join(' · ') || '管理账户与安全'}
            </span>
          </span>
          <ChevronRight size={17} className="text-white/35" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <span className="rounded-2xl bg-white/[0.07] px-3 py-2.5">
            <span className="block text-[9px] text-white/40">通知</span>
            <strong className="mt-0.5 block text-[10px] text-white">{pushEnabled ? '已开启' : '未开启'}</strong>
          </span>
          <span className="rounded-2xl bg-white/[0.07] px-3 py-2.5">
            <span className="block text-[9px] text-white/40">Google</span>
            <strong className="mt-0.5 block text-[10px] text-white">{isConnected ? '已连接' : '未连接'}</strong>
          </span>
          <span className="rounded-2xl bg-white/[0.07] px-3 py-2.5">
            <span className="block text-[9px] text-white/40">推送通道</span>
            <strong className="mt-0.5 block truncate text-[10px] text-white">{pushEnabled ? pushChannel.toUpperCase() : '—'}</strong>
          </span>
        </div>
      </button>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setPage('appearance')}
          className="rounded-[1.5rem] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 text-left shadow-sm"
        >
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#f4f2fb] text-[#665a91]">
            <Palette size={16} />
          </span>
          <strong className="mt-3 block text-sm font-black text-[var(--sf-text-primary)]">外观</strong>
          <span className="mt-1 block text-[10px] text-[var(--sf-text-tertiary)]">
            {preferences.appearance === 'system' ? '跟随系统' : preferences.appearance === 'dark' ? '深色模式' : '浅色模式'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setPage('tags')}
          className="rounded-[1.5rem] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 text-left shadow-sm"
        >
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#fff4df] text-[#8a642e]">
            <TagIcon size={16} />
          </span>
          <strong className="mt-3 block text-sm font-black text-[var(--sf-text-primary)]">标签</strong>
          <span className="mt-1 block text-[10px] text-[var(--sf-text-tertiary)]">分类、颜色与归档</span>
        </button>
        <button
          type="button"
          onClick={() => setPage('timeTracking')}
          className="rounded-[1.5rem] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 text-left shadow-sm"
        >
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#e7f2ef] text-[#3f6e65]">
            <Clock3 size={16} />
          </span>
          <strong className="mt-3 block text-sm font-black text-[var(--sf-text-primary)]">时间记录</strong>
          <span className="mt-1 block text-[10px] text-[var(--sf-text-tertiary)]">累计 {totalFocusMinutes} 分钟 · 今日 {todayFocusCount} 次 · 偏好设置</span>
        </button>
        <button
          type="button"
          onClick={() => setPage('notifications')}
          className="rounded-[1.5rem] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 text-left shadow-sm"
        >
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#eef6dc] text-[#526339]">
            <Bell size={16} />
          </span>
          <strong className="mt-3 block text-sm font-black text-[var(--sf-text-primary)]">提醒</strong>
          <span className="mt-1 block text-[10px] text-[var(--sf-text-tertiary)]">
            {pushEnabled ? '设备通知已开启' : '设备通知未开启'}
          </span>
        </button>
      </div>

      <Group title="偏好">
        <SettingRow
          icon={<Palette size={17} />}
          title="外观"
          description="跟随系统、浅色或深色"
          value={preferences.appearance === 'system' ? '跟随系统' : preferences.appearance === 'dark' ? '深色' : '浅色'}
          onClick={() => setPage('appearance')}
        />
        <SettingRow
          icon={<SlidersHorizontal size={17} />}
          title="计划与任务"
          description="四象限、分组与任务显示方式"
          value={preferences.quadrantEnabled ? '四象限已开启' : '仅列表'}
          onClick={() => setPage('task')}
        />
        <SettingRow
          icon={<TagIcon size={17} />}
          title="标签管理"
          description="名称、颜色、二级关系与归档"
          value="横向分类"
          onClick={() => setPage('tags')}
        />
        <SettingRow
          icon={<Bell size={17} />}
          title="通知与提醒"
          description="任务、课程、安静时段与测试通知"
          value={pushEnabled ? '已开启' : '未开启'}
          onClick={() => setPage('notifications')}
        />
      </Group>

      <Group title="连接">
        <SettingRow
          icon={<Cloud size={17} />}
          title="连接与同步"
          description="Google Calendar 与 Android 系统日历"
          value={isConnected ? 'Google 已连接' : '未连接'}
          onClick={() => setPage('connections')}
        />
      </Group>

      <Group title="数据">
        <SettingRow
          icon={<Database size={17} />}
          title="数据与备份"
          description="JSON 导入导出与课程备份"
          onClick={() => setPage('data')}
        />
      </Group>

      <Group title="账户">
        <SettingRow
          icon={<ShieldCheck size={17} />}
          title="账户与安全"
          description="账号信息、修改密码与退出"
          onClick={() => setPage('security')}
        />
        <SettingRow
          icon={<Info size={17} />}
          title="关于与诊断"
          description="版本、运行能力和通道状态"
          onClick={() => setPage('about')}
        />
      </Group>

      <div className="rounded-[1.5rem] border border-dashed border-[var(--sf-border)] bg-[var(--sf-surface)] px-4 py-3">
        <p className="text-xs font-bold text-[var(--sf-text-primary)]">只展示真实可用的设置</p>
        <p className="mt-1 text-[10px] leading-4 text-[var(--sf-text-tertiary)]">
          通知偏好已经跨 PWA / Android 共用；外观立即作用到当前设备。AI 模型与搜索源仍由服务端管理，因此这里不放“看起来能改、实际不生效”的 AI 开关。
        </p>
      </div>
    </div>
  );
}
