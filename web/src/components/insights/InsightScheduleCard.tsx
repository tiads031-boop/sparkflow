import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, RefreshCw } from 'lucide-react';
import {
  getInsightSchedule,
  listInsightRuns,
  regenerateInsightRun,
  retryInsightRun,
  updateInsightSchedule,
  type InsightGenerationRun,
  type InsightSchedulePreferences,
} from '../../api/insights';

const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const statusLabels: Record<InsightGenerationRun['status'], string> = {
  queued: '排队中',
  running: '生成中',
  completed: '已完成',
  skipped: '无内容跳过',
  failed: '失败',
};

function localTime(schedule: InsightSchedulePreferences) {
  return `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;
}

export function InsightScheduleCard({ onInsightsChanged }: { onInsightsChanged: () => void }) {
  const [schedule, setSchedule] = useState<InsightSchedulePreferences | null>(null);
  const [runs, setRuns] = useState<InsightGenerationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [nextSchedule, nextRuns] = await Promise.all([
        getInsightSchedule(),
        listInsightRuns(),
      ]);
      setSchedule(nextSchedule);
      setRuns(nextRuns);
    } catch (err: any) {
      setError(err?.message || '周期总结设置加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nextDescription = useMemo(() => {
    if (!schedule?.enabled) return '自动生成已关闭';
    if (schedule.cadence === 'weekly') {
      return `每${weekDays[schedule.weekDay]} ${localTime(schedule)} · ${schedule.timeZone}`;
    }
    return `每 ${schedule.intervalDays} 天 ${localTime(schedule)} · ${schedule.timeZone}`;
  }, [schedule]);

  const save = async () => {
    if (!schedule || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await updateInsightSchedule({
        ...schedule,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || schedule.timeZone,
      });
      setSchedule(saved);
      setMessage(saved.enabled ? '周期总结设置已保存。' : '自动生成已关闭，历史总结会保留。');
    } catch (err: any) {
      setError(err?.message || '设置保存失败');
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (run: InsightGenerationRun, action: 'retry' | 'regenerate') => {
    if (runningId) return;
    setRunningId(run.id);
    setMessage(null);
    setError(null);
    try {
      await (action === 'retry' ? retryInsightRun(run.id) : regenerateInsightRun(run.id));
      setMessage(action === 'retry' ? '已重新处理本期总结。' : '已生成一个明确的新版本，旧版本仍保留。');
      await load();
      onInsightsChanged();
    } catch (err: any) {
      setError(err?.message || '周期总结处理失败');
      await load();
    } finally {
      setRunningId(null);
    }
  };

  if (loading || !schedule) {
    return (
      <div className="rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-4 text-xs text-[var(--sf-text-secondary)]">
        正在加载周期总结设置…
      </div>
    );
  }

  return (
    <section className="rounded-[var(--sf-radius-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--sf-text-primary)]">
            <CalendarClock size={16} /> 周期总结
          </div>
          <p className="mt-1 text-[10px] leading-4 text-[var(--sf-text-tertiary)]">
            只处理本期新增记录和旧记录上的新 Reflection。关闭后不会新建自动总结。
          </p>
        </div>
        <button
          type="button"
          aria-pressed={schedule.enabled}
          onClick={() => setSchedule({ ...schedule, enabled: !schedule.enabled })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${schedule.enabled ? 'bg-[#242424]' : 'bg-[var(--sf-border)]'}`}
        >
          <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${schedule.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {schedule.enabled && (
        <div className="mt-4 space-y-3 rounded-2xl bg-[var(--sf-bg)] p-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSchedule({ ...schedule, cadence: 'weekly' })}
              className={`rounded-full px-3 py-2 text-[11px] font-bold ${schedule.cadence === 'weekly' ? 'bg-[#242424] text-white' : 'bg-[var(--sf-surface)]'}`}
            >
              每周
            </button>
            <button
              type="button"
              onClick={() => setSchedule({ ...schedule, cadence: 'interval' })}
              className={`rounded-full px-3 py-2 text-[11px] font-bold ${schedule.cadence === 'interval' ? 'bg-[#242424] text-white' : 'bg-[var(--sf-surface)]'}`}
            >
              每 N 天
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {schedule.cadence === 'weekly' ? (
              <label className="text-[10px] font-semibold text-[var(--sf-text-secondary)]">
                星期
                <select
                  value={schedule.weekDay}
                  onChange={(event) => setSchedule({ ...schedule, weekDay: Number(event.target.value) })}
                  className="mt-1 w-full rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] px-3 py-2 text-xs"
                >
                  {weekDays.map((day, index) => <option key={day} value={index}>{day}</option>)}
                </select>
              </label>
            ) : (
              <label className="text-[10px] font-semibold text-[var(--sf-text-secondary)]">
                间隔天数
                <input
                  type="number"
                  min="2"
                  max="90"
                  value={schedule.intervalDays}
                  onChange={(event) => setSchedule({ ...schedule, intervalDays: Number(event.target.value) })}
                  className="mt-1 w-full rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] px-3 py-2 text-xs"
                />
              </label>
            )}
            <label className="text-[10px] font-semibold text-[var(--sf-text-secondary)]">
              生成时间
              <input
                type="time"
                value={localTime(schedule)}
                onChange={(event) => {
                  const [hour, minute] = event.target.value.split(':').map(Number);
                  setSchedule({ ...schedule, hour, minute });
                }}
                className="mt-1 w-full rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] px-3 py-2 text-xs"
              />
            </label>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[10px] text-[var(--sf-text-tertiary)]">{nextDescription}</p>
        <button type="button" disabled={busy} onClick={() => void save()} className="rounded-full bg-[#cae393] px-4 py-2 text-[11px] font-bold text-[#242424] disabled:opacity-40">
          {busy ? '保存中…' : '保存设置'}
        </button>
      </div>

      {message && <p className="mt-3 rounded-xl bg-[#eef6dc] px-3 py-2 text-[10px] text-[#526339]">{message}</p>}
      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[10px] text-red-700">{error}</p>}

      {runs.length > 0 && (
        <div className="mt-4 border-t border-[var(--sf-border)] pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold text-[var(--sf-text-tertiary)]">最近运行</span>
            <button type="button" onClick={() => void load()} className="flex items-center gap-1 text-[10px] text-[var(--sf-text-tertiary)]"><RefreshCw size={10} /> 刷新</button>
          </div>
          <div className="space-y-2">
            {runs.slice(0, 3).map((run) => (
              <div key={run.id} className="rounded-xl bg-[var(--sf-bg)] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-[var(--sf-text-secondary)]">
                    {new Date(run.periodStart).toLocaleDateString('zh-CN')}–{new Date(run.periodEnd).toLocaleDateString('zh-CN')}
                  </span>
                  <span className="text-[10px] text-[var(--sf-text-tertiary)]">{statusLabels[run.status]}</span>
                </div>
                <p className="mt-1 text-[9px] text-[var(--sf-text-tertiary)]">
                  覆盖 {run.sourceCount} 条来源 · 生成 {run.insightCount} 条
                </p>
                {(run.status === 'failed' || run.status === 'skipped' || run.status === 'completed') && (
                  <button
                    type="button"
                    disabled={runningId === run.id}
                    onClick={() => void runAction(run, run.status === 'completed' ? 'regenerate' : 'retry')}
                    className="mt-2 rounded-full bg-[var(--sf-surface)] px-3 py-1.5 text-[10px] font-bold shadow-sm disabled:opacity-40"
                  >
                    {runningId === run.id ? <Loader2 size={10} className="inline animate-spin" /> : null}
                    {run.status === 'completed' ? '明确重新生成' : '重试本期'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
