import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrainCircuit, Check, RotateCcw, Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import { useModalLifecycle } from '../ui/useModalLifecycle';
import type { PlannerPreview } from '../../types';

function dateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function PlannerSheet({
  open,
  selectedDate,
  onClose,
  onApplied,
  onPreviewChange,
}: {
  open: boolean;
  selectedDate: Date;
  onClose: () => void;
  onApplied: () => Promise<void>;
  onPreviewChange?: (preview: PlannerPreview | null) => void;
}) {
  const [date, setDate] = useState(dateInput(selectedDate));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('22:00');
  const [preview, setPreview] = useState<PlannerPreview | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const close = useCallback(() => onClose(), [onClose]);
  useModalLifecycle(open, close);

  useEffect(() => {
    if (open && !preview && !planId) setDate(dateInput(selectedDate));
  }, [open, planId, preview, selectedDate]);

  const clearPreview = () => {
    setPreview(null);
    onPreviewChange?.(null);
  };

  if (!open) return null;

  const generate = async () => {
    setBusy(true);
    setMessage('');
    setPlanId(null);
    try {
      const result = await api.post<PlannerPreview>(
        '/planner/preview',
        {
          availabilityStart: localIso(date, startTime),
          availabilityEnd: localIso(date, endTime),
        },
        { throwOnError: true, timeoutMs: 45_000 },
      );
      setPreview(result);
      onPreviewChange?.(result);
      if (!result.proposals.length) setMessage('当前范围内没有可自动安排的未排期任务。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '生成安排失败');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview?.proposals.length) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await api.post<{ planId: string; appliedCount: number }>(
        '/planner/apply',
        { proposals: preview.proposals },
        { throwOnError: true },
      );
      setPlanId(result.planId);
      setMessage(`已安排 ${result.appliedCount} 项任务，可在时间轴中查看。`);
      await onApplied();
      onPreviewChange?.(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '应用安排失败');
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!planId) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await api.post<{ restoredCount: number }>(`/planner/${planId}/undo`, undefined, {
        throwOnError: true,
      });
      setPlanId(null);
      clearPreview();
      setMessage(`已撤销，恢复 ${result.restoredCount} 项任务。`);
      await onApplied();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '撤销失败');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex justify-center bg-[var(--sf-surface)]"
    >
      <section role="dialog" aria-modal="true" aria-label="智能安排" className="h-dvh w-full max-w-xl overflow-y-auto bg-[var(--sf-surface)] px-6 pb-[calc(env(safe-area-inset-bottom,0px)+28px)] pt-[calc(env(safe-area-inset-top,0px)+20px)]">
        <header className="mb-8">
          <button
            type="button"
            onClick={close}
            className="rounded-full bg-[var(--sf-bg)] px-5 py-2.5 text-sm font-medium shadow-sm btn-press focus-ring"
          >
            关闭
          </button>
          <div className="mt-12 flex items-center gap-2 text-[var(--sf-marker-purple)]">
            <BrainCircuit size={18} />
            <span className="text-xs font-bold tracking-widest">SMART PLANNER</span>
          </div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">把任务，交给 SparkFlow。</h2>
          <p className="mt-2 text-sm text-[var(--sf-text-secondary)]">选择一天和可用时段，先预览，再写入日程。</p>
        </header>

        <div className="space-y-5">
          <label className="flex items-center justify-between gap-4 text-sm font-medium">
            安排日期
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                clearPreview();
              }}
              className="min-w-0 rounded-full bg-[var(--sf-bg)] px-4 py-2.5 text-right text-sm font-normal outline-none"
            />
          </label>
          <div className="rounded-[var(--sf-radius-md)] bg-[var(--sf-bg)] p-4">
            <p className="mb-4 text-sm font-medium">一天里可安排的时间</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--sf-text-secondary)]">
                从几点开始
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => {
                    setStartTime(event.target.value);
                    clearPreview();
                  }}
                  className="mt-2 w-full rounded-full bg-[var(--sf-surface)] px-4 py-2.5 text-center text-sm font-medium outline-none"
                />
              </label>
              <label className="text-xs text-[var(--sf-text-secondary)]">
                最晚几点结束
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => {
                    setEndTime(event.target.value);
                    clearPreview();
                  }}
                  className="mt-2 w-full rounded-full bg-[var(--sf-surface)] px-4 py-2.5 text-center text-sm font-medium outline-none"
                />
              </label>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-[var(--sf-text-tertiary)]">
          会自动避开课程、会议和已有安排，优先处理高优先级与临近截止任务；锁定事项不会被移动。
        </p>
        <button
          type="button"
          disabled={busy || !date || startTime >= endTime}
          onClick={() => void generate()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sf-text-primary)] py-3.5 font-bold text-[var(--sf-surface)] disabled:opacity-40"
        >
          <Sparkles size={17} />
          {busy ? '正在计算…' : preview ? '重新看看怎么安排' : '看看怎么安排'}
        </button>

        {preview && preview.proposals.length > 0 && (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">安排预览</h3>
              <span className="text-xs text-[var(--sf-text-tertiary)]">{preview.proposals.length} 项</span>
            </div>
            {preview.proposals.map((proposal) => (
              <article key={proposal.taskId} className="rounded-[var(--sf-radius-sm)] bg-[var(--sf-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-bold">{proposal.title}</h4>
                    <p className="mt-1 text-xs text-[var(--sf-text-secondary)]">
                      {timeLabel(proposal.start)}–{timeLabel(proposal.end)} · {proposal.durationMinutes} 分钟
                    </p>
                  </div>
                  <Check size={16} className="mt-0.5 shrink-0 text-[var(--sf-marker-green)]" />
                </div>
                <p className="mt-2 text-[11px] text-[var(--sf-text-tertiary)]">{proposal.reason}</p>
              </article>
            ))}
            {preview.unscheduledTaskIds.length > 0 && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                另有 {preview.unscheduledTaskIds.length} 项因时间不足或截止约束未安排。
              </p>
            )}
            {!planId && (
              <button
                type="button"
                onClick={close}
                className="w-full rounded-full border border-dashed border-[var(--sf-marker-purple)] py-3 text-sm font-bold text-[var(--sf-marker-purple)]"
              >
                返回计划查看时间块预览
              </button>
            )}
          </div>
        )}

        {message && <p className="mt-4 rounded-2xl bg-[var(--sf-surface)] px-4 py-3 text-sm">{message}</p>}
        {preview?.proposals.length ? (
          <button
            type="button"
            disabled={busy || !!planId}
            onClick={() => void apply()}
            className="mt-4 w-full rounded-full bg-[var(--sf-accent)] py-3.5 font-bold disabled:opacity-40"
          >
            {planId ? '已应用到时间轴' : '确认并应用'}
          </button>
        ) : null}
        {planId && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void undo()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sf-surface)] py-3.5 font-bold disabled:opacity-40"
          >
            <RotateCcw size={16} />
            撤销本次安排
          </button>
        )}
      </section>
    </div>,
    document.body,
  );
}
