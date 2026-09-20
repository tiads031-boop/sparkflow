import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pause, Play, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import ModalCloseButton from '../ui/ModalCloseButton';
import { useModalLifecycle } from '../ui/useModalLifecycle';

const DURATIONS = [15, 25, 45, 60];

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export default function FocusSession({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tasks = useAppStore((state) => state.tasks);
  const pomodoro = useAppStore((state) => state.pomodoro);
  const startPomodoro = useAppStore((state) => state.startPomodoro);
  const pausePomodoro = useAppStore((state) => state.pausePomodoro);
  const resumePomodoro = useAppStore((state) => state.resumePomodoro);
  const stopPomodoro = useAppStore((state) => state.stopPomodoro);
  const completePomodoro = useAppStore((state) => state.completePomodoro);
  const updateTask = useAppStore((state) => state.updateTask);
  const availableTasks = useMemo(() => tasks.filter((task) => !['Done', 'Cancelled'].includes(task.status)), [tasks]);
  const [taskId, setTaskId] = useState(pomodoro.activeTaskId ?? '');
  const [duration, setDuration] = useState(Math.round(pomodoro.duration / 60) || 25);
  const [hasStarted, setHasStarted] = useState(pomodoro.isRunning);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const ended = hasStarted && !pomodoro.isRunning;
  const progress = pomodoro.duration > 0 ? Math.max(0, Math.min(1, pomodoro.timeLeft / pomodoro.duration)) : 0;
  const task = tasks.find((candidate) => candidate.id === (pomodoro.activeTaskId || taskId));

  useEffect(() => {
    if (open && pomodoro.isRunning) setHasStarted(true);
  }, [open, pomodoro.isRunning]);

  const start = async () => {
    setBusy(true);
    setMessage('');
    try {
      await startPomodoro(taskId || undefined, duration);
      setHasStarted(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法开始专注');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    setMessage('');
    try {
      await completePomodoro();
    } catch {
      setMessage('专注记录同步失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const exit = useCallback(() => {
    if (!pomodoro.isRunning) setHasStarted(false);
    onClose();
  }, [onClose, pomodoro.isRunning]);
  const requestClose = useCallback(() => { exit(); }, [exit]);

  useModalLifecycle(open, requestClose);
  if (!open) return null;

  const finishTask = async () => {
    if (task) await updateTask(task.id, { status: 'Done' });
    onClose();
  };

  const abandon = async () => {
    if (!window.confirm('放弃本次专注？已投入时间不会写入日程。')) return;
    setBusy(true);
    try {
      await stopPomodoro();
      setHasStarted(false);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '放弃专注失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const togglePause = async () => {
    setBusy(true);
    setMessage('');
    try {
      await (pomodoro.isPaused ? resumePomodoro() : pausePomodoro());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '专注状态同步失败');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[var(--sf-bg)] text-[var(--sf-text-primary)]"
      role="dialog"
      aria-modal="true"
      aria-label="专注模式"
    >
      <header className="flex items-center justify-between px-5 pb-3 pt-[calc(env(safe-area-inset-top,0px)+20px)]">
        <div>
          <p className="text-xs font-bold tracking-[0.22em] text-[var(--sf-marker-purple)]">FOCUS</p>
          <h2 className="text-lg font-bold">专注这一件事</h2>
        </div>
        <ModalCloseButton onClick={exit} label="收起专注" />
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-7 overflow-y-auto px-6 py-4">
        {!hasStarted ? (
          <section className="w-full space-y-6 rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-5">
            <label className="block text-sm font-bold">
              关联任务
              <select
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                className="mt-2 w-full rounded-2xl bg-[var(--sf-bg)] px-4 py-3 font-normal outline-none"
              >
                <option value="">不关联任务</option>
                {availableTasks.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="mb-2 text-sm font-bold">专注时长</p>
              <div className="grid grid-cols-4 gap-2">
                {DURATIONS.map((minutes) => (
                  <button
                    type="button"
                    key={minutes}
                    onClick={() => setDuration(minutes)}
                    className={`rounded-2xl py-3 text-sm font-bold ${duration === minutes ? 'bg-[var(--sf-text-primary)] text-[var(--sf-surface)]' : 'bg-[var(--sf-bg)]'}`}
                  >
                    {minutes} 分
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void start()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sf-text-primary)] py-4 font-bold text-[var(--sf-surface)] disabled:opacity-50"
            >
              <Play size={18} fill="currentColor" />
              开始专注
            </button>
          </section>
        ) : ended ? (
          <section className="w-full space-y-5 text-center">
            <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-[var(--sf-accent)]">
              <Check size={44} />
            </div>
            <div>
              <h3 className="text-2xl font-bold">完成一次专注</h3>
              <p className="mt-1 text-sm text-[var(--sf-text-secondary)]">
                有效专注 {Math.max(1, Math.round(pomodoro.lastCompletedEffectiveSeconds / 60))} 分钟
                {pomodoro.pausedDurationSeconds > 0 ? ` · 暂停 ${Math.round(pomodoro.pausedDurationSeconds / 60)} 分钟` : ''}
                {task ? ` · ${task.title}` : ''}
              </p>
            </div>
            {task && (
              <button
                type="button"
                onClick={() => void finishTask()}
                className="w-full rounded-full bg-[var(--sf-text-primary)] py-4 font-bold text-[var(--sf-surface)]"
              >
                完成关联任务
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-[var(--sf-surface)] py-4 font-bold"
            >
              返回今天
            </button>
          </section>
        ) : (
          <section className="flex w-full flex-col items-center gap-7 text-center">
            <div>
              <p className="text-sm text-[var(--sf-text-secondary)]">正在专注</p>
              <h3 className="mt-1 max-w-xs truncate text-xl font-bold">{task?.title || '自由专注'}</h3>
            </div>
            <div
              className="relative grid h-64 w-64 place-items-center rounded-full"
              style={{
                background: `conic-gradient(var(--sf-marker-purple) ${progress * 360}deg, var(--sf-surface) 0deg)`,
              }}
            >
              <div className="grid h-[232px] w-[232px] place-items-center rounded-full bg-[var(--sf-bg)]">
                <span className="text-6xl font-light tabular-nums tracking-tight">{formatTime(pomodoro.timeLeft)}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => void abandon()}
                className="grid h-12 w-12 place-items-center rounded-full bg-[var(--sf-surface)]"
                aria-label="放弃本次专注"
              >
                <RotateCcw size={19} />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void togglePause()}
                className="grid h-16 w-16 place-items-center rounded-full bg-[var(--sf-marker-purple)]"
                aria-label={pomodoro.isPaused ? '继续' : '暂停'}
              >
                {pomodoro.isPaused ? <Play size={25} fill="currentColor" /> : <Pause size={25} fill="currentColor" />}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finish()}
                className="grid h-12 w-12 place-items-center rounded-full bg-[var(--sf-accent)] disabled:opacity-50"
                aria-label="提前完成"
              >
                <Check size={20} />
              </button>
            </div>
            <p className="text-xs text-[var(--sf-text-tertiary)]">
              {pomodoro.isPaused ? '已暂停，准备好后继续' : '保持呼吸，把注意力留在当下'}
            </p>
          </section>
        )}
        {(message || pomodoro.syncError) && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {message || pomodoro.syncError}
          </p>
        )}
      </main>
    </div>,
    document.body,
  );
}
