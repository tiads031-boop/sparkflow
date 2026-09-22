import { useCallback, useEffect, useState } from 'react';
import { Clock3, Loader2, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import {
  createGoalProgressEntry,
  deleteGoalProgressEntry,
  fetchGoalProgress,
} from '../../api/study';
import {
  goalProgressLabel,
  goalProgressType,
  progressBarWidth,
  progressHeadline,
} from '../../lib/goalProgress';
import type { GoalProgressSummary, StudyFolder } from '../../types';

export default function GoalProgressPanel({
  goal,
  onEdit,
}: {
  goal: StudyFolder;
  onEdit: () => void;
}) {
  const [summary, setSummary] = useState<GoalProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const type = goalProgressType(goal);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchGoalProgress(goal.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载目标进度失败');
    } finally {
      setLoading(false);
    }
  }, [goal.id]);

  useEffect(() => {
    let active = true;
    void fetchGoalProgress(goal.id)
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : '加载目标进度失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [goal.id, goal.progressType, goal.targetValue, goal.progressUnit]);

  const recordProgress = async () => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount === 0 || saving) {
      setError('请输入有效的非零进度变化');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createGoalProgressEntry(goal.id, {
        value: amount,
        note: note.trim() || null,
      });
      setValue('');
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '记录进度失败');
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (entryId: string) => {
    if (!window.confirm('删除这条进度记录？总进度会随之重新计算。')) return;
    setSaving(true);
    setError(null);
    try {
      await deleteGoalProgressEntry(goal.id, entryId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除进度记录失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="rounded-[1.8rem] p-5 shadow-sm"
      style={{ backgroundColor: `${goal.color}25` }}
      aria-busy={loading}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
          style={{ backgroundColor: goal.color }}
        >
          <Target size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">
                {goalProgressLabel(type)}
              </p>
              <h2 className="mt-0.5 text-lg font-black text-[#242424]">
                {summary ? progressHeadline(summary) : '目标进度'}
              </h2>
            </div>
            {goal.status === 'active' && (
              <button
                type="button"
                onClick={onEdit}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/80 text-gray-500"
                aria-label="编辑进度指标"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {goal.description || 'AI 会继续通过对话完善成功标准和执行策略。'}
          </p>
        </div>
      </div>

      {loading && !summary ? (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-gray-400" />
        </div>
      ) : summary ? (
        <>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
              <span>
                {summary.primary.target === null ? '还未设置目标值' : '总体完成度'}
              </span>
              <span>
                {summary.primary.percent === null
                  ? '—'
                  : `${summary.primary.percent}%`}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
              <div
                className="h-full rounded-full bg-[#242424] transition-[width]"
                style={{ width: `${progressBarWidth(summary.primary.percent)}%` }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/75 px-3 py-3">
              <p className="text-[9px] font-bold text-gray-400">任务</p>
              <p className="mt-1 text-sm font-black text-[#242424]">
                {summary.task.completed}/{summary.task.total}
              </p>
            </div>
            <div className="rounded-2xl bg-white/75 px-3 py-3">
              <p className="text-[9px] font-bold text-gray-400">累计投入</p>
              <p className="mt-1 text-sm font-black text-[#242424]">
                {summary.actual.totalMinutes}<span className="ml-0.5 text-[9px] text-gray-400">分钟</span>
              </p>
            </div>
            <div className="rounded-2xl bg-white/75 px-3 py-3">
              <p className="text-[9px] font-bold text-gray-400">近 7 天</p>
              <p className="mt-1 text-sm font-black text-[#242424]">
                {summary.actual.weekMinutes}<span className="ml-0.5 text-[9px] text-gray-400">分钟</span>
              </p>
            </div>
          </div>

          {type === 'numeric' && goal.status === 'active' && (
            <div className="mt-4 rounded-[1.4rem] bg-white/75 p-3">
              <div className="flex items-center gap-2 text-xs font-black text-[#242424]">
                <Plus size={13} /> 记录进度变化
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-2">
                <label className="text-[9px] font-bold text-gray-400">
                  增减值
                  <input
                    type="number"
                    step="any"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="如 5 或 -2"
                    className="mt-1 w-full rounded-xl bg-[#f4f4f6] px-3 py-2.5 text-xs text-[#242424] outline-none ring-2 ring-transparent focus:ring-[#cae393]"
                  />
                </label>
                <label className="text-[9px] font-bold text-gray-400">
                  备注（可选）
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={500}
                    placeholder="完成了哪一部分"
                    className="mt-1 w-full rounded-xl bg-[#f4f4f6] px-3 py-2.5 text-xs text-[#242424] outline-none ring-2 ring-transparent focus:ring-[#cae393]"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void recordProgress()}
                disabled={saving || !value}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#242424] py-2.5 text-xs font-black text-[#cae393] disabled:opacity-45"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                保存记录
              </button>
            </div>
          )}

          {type === 'numeric' && summary.numeric.entries.length > 0 && (
            <div className="mt-3 space-y-2">
              {summary.numeric.entries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 rounded-2xl bg-white/65 px-3 py-2.5">
                  <span className={`text-xs font-black ${entry.value > 0 ? 'text-[#647d38]' : 'text-[#a34f5f]'}`}>
                    {entry.value > 0 ? '+' : ''}{entry.value} {summary.numeric.unit}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[10px] text-gray-400">
                    {entry.note || new Date(entry.occurredAt).toLocaleDateString('zh-CN')}
                  </span>
                  {goal.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => void removeEntry(entry.id)}
                      disabled={saving}
                      className="grid h-7 w-7 place-items-center rounded-full text-gray-300 hover:bg-red-50 hover:text-red-500"
                      aria-label="删除进度记录"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {type === 'time' && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-white/65 px-3 py-2.5 text-[10px] leading-4 text-gray-500">
              <Clock3 size={13} className="mt-0.5 shrink-0" />
              完成或中断的有效专注会自动累计；关闭“计入实际时间”的记录不会推动进度。
            </p>
          )}
        </>
      ) : null}

      {error && (
        <div className="mt-4 rounded-2xl bg-red-50 px-3 py-3 text-xs text-red-700">
          <p>{error}</p>
          {!summary && (
            <button type="button" onClick={() => void load()} className="mt-2 font-black underline">
              重新加载
            </button>
          )}
        </div>
      )}
    </section>
  );
}
