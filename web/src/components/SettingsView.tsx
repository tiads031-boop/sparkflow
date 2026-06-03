import { useEffect, useState } from 'react';
import {
  Settings,
  Link,
  Unlink,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  Calendar,
  Smartphone,
  Download,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import {
  checkCalendarPermission,
  exportTasksToSystemCalendar,
  importLocalCalendarEvents,
  isSystemCalendarAvailable,
  requestCalendarPermission,
} from '../capacitor/calendar';

/** 相对时间格式化 */
function relativeTime(isoStr: string | null): string {
  if (!isoStr) return '从未同步';
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffMs = now - then;
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

/** 同步范围选项（UI only，后端实际过滤逻辑后续实现） */
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
  { key: 'sparks', label: '灵感', description: '灵感卡片（通常不同步）', enabled: false },
];

export default function SettingsView() {
  const tasks = useAppStore((s) => s.tasks);
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
  const loadTasks = useAppStore((s) => s.loadTasks);

  const [scopes, setScopes] = useState<SyncScope[]>(defaultScopes);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [hasLocalPermission, setHasLocalPermission] = useState(false);
  const [isLocalBusy, setIsLocalBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const canUseSystemCalendar = isSystemCalendarAvailable();

  useEffect(() => {
    if (!canUseSystemCalendar) return;
    checkCalendarPermission().then(setHasLocalPermission).catch(() => setHasLocalPermission(false));
  }, [canUseSystemCalendar]);

  const toggleScope = (key: string) => {
    setScopes((prev) =>
      prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s)),
    );
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
    } catch (err: any) {
      setLocalMessage(err.message || '导入本地日历失败');
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
    } catch (err: any) {
      setLocalMessage(err.message || '写入系统日历失败');
    } finally {
      setIsLocalBusy(false);
    }
  };

  return (
    <div className="animate-page-enter pb-24">
      <h1 className="text-xl font-bold mb-5 text-[#242424]">设置</h1>

      <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#242424] flex items-center justify-center">
            <Calendar size={16} className="text-[#cae393]" />
          </div>
          <h2 className="text-sm font-bold text-[#242424]">Google Calendar</h2>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="flex-1 text-xs text-red-700">{error}</p>
            <button
              onClick={clearError}
              className="text-xs text-red-400 hover:text-red-600 flex-shrink-0"
            >
              关闭
            </button>
          </div>
        )}

        {!isConnected && (
          <>
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#f4f4f6] flex items-center justify-center">
                <Link size={24} className="text-gray-400" />
              </div>
              <p className="text-sm font-medium text-[#242424] mb-1">未连接</p>
              <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
                连接后可同步 SparkFlow 任务、课程和手动日程，授权完成后会自动执行一次同步。
              </p>
            </div>

            <button
              onClick={connectGoogle}
              disabled={isConnecting}
              className="w-full py-3 rounded-full bg-[#242424] text-[#cae393] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#1a1a1a] transition-colors active:scale-[0.98] disabled:opacity-60"
            >
              {isConnecting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  正在连接...
                </>
              ) : (
                <>
                  <Link size={16} />
                  连接 Google 日历
                </>
              )}
            </button>
          </>
        )}

        {isConnected && (
          <>
            <div className="bg-[#f4f4f6] rounded-2xl p-4 mb-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#cae393] flex items-center justify-center flex-shrink-0">
                  <Check size={12} className="text-[#242424]" />
                </div>
                <span className="text-sm font-medium text-[#242424]">
                  已连接：{googleEmail || 'Google 账号'}
                </span>
              </div>
              <p className="text-xs text-gray-500">上次同步：{relativeTime(lastSyncAt)}</p>
              <p className="text-xs text-gray-500">同步状态：{syncedCount} 个事件已同步</p>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="flex-1 py-2.5 rounded-full bg-[#cae393] text-[#242424] text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-[#b8d481] transition-colors active:scale-[0.98] disabled:opacity-60"
              >
                {isSyncing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    同步中...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    立即同步
                  </>
                )}
              </button>

              {!showDisconnectConfirm ? (
                <button
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="flex-1 py-2.5 rounded-full bg-[#f4f4f6] text-gray-500 text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-colors active:scale-[0.98]"
                >
                  <Unlink size={14} />
                  断开连接
                </button>
              ) : (
                <div className="flex-1 flex gap-1.5">
                  <button
                    onClick={() => {
                      disconnectGoogle();
                      setShowDisconnectConfirm(false);
                    }}
                    className="flex-1 py-2.5 rounded-full bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors active:scale-[0.98]"
                  >
                    确认断开
                  </button>
                  <button
                    onClick={() => setShowDisconnectConfirm(false)}
                    className="flex-1 py-2.5 rounded-full bg-[#f4f4f6] text-gray-500 text-xs font-medium hover:bg-gray-100 transition-colors active:scale-[0.98]"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-xs font-bold text-[#242424] mb-3">同步范围</h3>
          <div className="space-y-2">
            {scopes.map((scope) => (
              <label
                key={scope.key}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#f4f4f6] transition-colors cursor-pointer"
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                    scope.enabled ? 'bg-[#cae393] border-[#cae393]' : 'bg-white border-gray-300'
                  }`}
                  onClick={() => toggleScope(scope.key)}
                >
                  {scope.enabled && <Check size={12} className="text-[#242424]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[#242424] font-medium block">{scope.label}</span>
                  <span className="text-[10px] text-gray-400 block truncate">
                    {scope.description}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#b0a8db]/20 flex items-center justify-center">
            <Smartphone size={16} className="text-[#b0a8db]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#242424]">Android 本地日历</h2>
            <p className="text-[10px] text-gray-400">适用于 Xiaomi / MIUI 系统日历</p>
          </div>
        </div>

        {!canUseSystemCalendar ? (
          <div className="rounded-2xl bg-[#f4f4f6] p-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              Web 端不能读取本机系统日历。请在 Android App 内导入 Xiaomi 本地日历；当前 Web 端可使用 Google 同步或 ICS 课表导入。
            </p>
          </div>
        ) : (
          <>
            <div className="bg-[#f4f4f6] rounded-2xl p-4 mb-4 flex items-center gap-2">
              <ShieldCheck size={16} className={hasLocalPermission ? 'text-green-600' : 'text-gray-400'} />
              <span className="text-xs text-gray-500">
                {hasLocalPermission ? '已获得系统日历读写权限' : '需要系统日历读写权限'}
              </span>
            </div>

            {localMessage && (
              <div className="mb-4 text-xs px-4 py-2 rounded-xl bg-[#cae393]/30 text-[#242424]">
                {localMessage}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={handleRequestLocalPermission}
                disabled={isLocalBusy}
                className="py-2.5 rounded-full bg-[#242424] text-white text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-60"
              >
                {isLocalBusy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                授权系统日历
              </button>
              <button
                onClick={handleImportLocal}
                disabled={isLocalBusy}
                className="py-2.5 rounded-full bg-[#cae393] text-[#242424] text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-60"
              >
                {isLocalBusy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                导入近期本地事件
              </button>
              <button
                onClick={handleExportLocal}
                disabled={isLocalBusy}
                className="py-2.5 rounded-full bg-[#f4f4f6] text-gray-600 text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-60"
              >
                {isLocalBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                写入 SparkFlow 日程
              </button>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-[2rem] p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#b0a8db]/20 flex items-center justify-center">
            <Settings size={16} className="text-[#b0a8db]" />
          </div>
          <h2 className="text-sm font-bold text-[#242424]">关于</h2>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">版本</span>
            <span className="text-sm text-[#242424] font-medium">v1.0</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">技术栈</span>
            <span className="text-xs text-gray-400">React + NestJS + Supabase</span>
          </div>
        </div>
      </div>
    </div>
  );
}
