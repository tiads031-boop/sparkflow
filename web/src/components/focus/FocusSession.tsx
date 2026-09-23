import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/appStore';
import InspirationCaptureSheet from '../records/InspirationCaptureSheet';
import { apiRequest } from '../../api/client';
import ModalCloseButton from '../ui/ModalCloseButton';
import { useModalLifecycle } from '../ui/useModalLifecycle';
import FocusCompleted from './FocusCompleted';
import FocusRunning from './FocusRunning';
import FocusSetup, { type FocusMode } from './FocusSetup';
import { useTimeTrackingPreferences } from '../profile/useTimeTrackingPreferences';

export default function FocusSession({ open, onClose }: { open: boolean; onClose: () => void }) {
  const timeTrackingPreferences = useTimeTrackingPreferences();
  const tasks = useAppStore((state) => state.tasks);
  const pomodoro = useAppStore((state) => state.pomodoro);
  const startPomodoro = useAppStore((state) => state.startPomodoro);
  const pausePomodoro = useAppStore((state) => state.pausePomodoro);
  const resumePomodoro = useAppStore((state) => state.resumePomodoro);
  const stopPomodoro = useAppStore((state) => state.stopPomodoro);
  const completePomodoro = useAppStore((state) => state.completePomodoro);
  const updateTask = useAppStore((state) => state.updateTask);
  const availableTasks = useMemo(() => tasks.filter((task) => !['Done', 'Cancelled'].includes(task.status)), [tasks]);
  const [taskId, setTaskId] = useState(() => pomodoro.activeTaskId ?? '');
  const [title, setTitle] = useState(() => pomodoro.title ?? '');
  const [notes, setNotes] = useState(() => pomodoro.notes ?? '');
  const [duration, setDuration] = useState(() => Math.round(pomodoro.duration / 60) || 25);
  const [focusMode, setFocusMode] = useState<FocusMode>(() => pomodoro.focusMode || 'countdown');
  const [hasStarted, setHasStarted] = useState(() => pomodoro.isRunning);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [savedRecordCount, setSavedRecordCount] = useState(0);
  const activeOrSeen = hasStarted || pomodoro.isRunning;
  const ended = activeOrSeen && !pomodoro.isRunning;
  const task = tasks.find((candidate) => candidate.id === (ended ? taskId : pomodoro.activeTaskId || taskId));

  useEffect(() => {
    if (!open || !pomodoro.isRunning) return;
    const timeoutId = window.setTimeout(() => {
      setHasStarted(true);
      setTaskId(pomodoro.activeTaskId || '');
      setTitle(pomodoro.title || '');
      setNotes(pomodoro.notes || '');
      setFocusMode(pomodoro.focusMode);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [open, pomodoro.activeTaskId, pomodoro.focusMode, pomodoro.isRunning, pomodoro.title, pomodoro.notes]);

  const start = async () => {
    setBusy(true);
    setMessage('');
    try {
      await startPomodoro(taskId || undefined, duration, focusMode, title, notes);
      setSavedRecordCount(0);
      setHasStarted(true);
    } catch (error: unknown) {
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
      window.dispatchEvent(new CustomEvent('sparkflow:scenes-changed'));
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : '专注记录同步失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    if (!window.confirm('结束当前专注并重新设置？已投入时间会保留在 Actual Timeline。')) return;
    setBusy(true);
    setMessage('');
    try {
      await stopPomodoro();
      setHasStarted(false);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : '结束专注失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const togglePause = async () => {
    setBusy(true);
    setMessage('');
    try {
      await (pomodoro.isPaused ? resumePomodoro() : pausePomodoro());
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : '专注状态同步失败');
    } finally {
      setBusy(false);
    }
  };

  const closeCompleted = () => {
    setHasStarted(false);
    setSavedRecordCount(0);
    onClose();
  };

  const finishTask = async () => {
    if (task) await updateTask(task.id, { status: 'Done' });
    closeCompleted();
  };

  const saveCompleted = async () => {
    if (!pomodoro.lastCompletedSessionId || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await apiRequest(`/pomodoro/${pomodoro.lastCompletedSessionId}/focus`, {
        method: 'PATCH',
        body: JSON.stringify({ title, notes, taskId: taskId || null }),
      });
      window.dispatchEvent(new Event('sparkflow:actual-changed'));
      window.dispatchEvent(new Event('sparkflow:calendar-changed'));
      setMessage('已保存专注内容');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请重试');
    } finally { setBusy(false); }
  };

  const exit = useCallback(() => {
    if (!pomodoro.isRunning) setHasStarted(false);
    onClose();
  }, [onClose, pomodoro.isRunning]);
  useModalLifecycle(open, exit);
  if (!open) return null;

  const stateLabel = !activeOrSeen ? 'Setup' : ended ? 'Completed' : pomodoro.isPaused ? 'Paused' : 'Running';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--sf-bg)] text-[var(--sf-text-primary)]" role="dialog" aria-modal="true" aria-label="专注模式">
      <header className="flex items-center justify-between px-5 pb-3 pt-[calc(env(safe-area-inset-top,0px)+20px)]">
        <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--sf-marker-purple)]">Focus · {stateLabel}</p><h2 className="mt-0.5 text-lg font-black">专注这一件事</h2></div>
        <ModalCloseButton onClick={exit} label="收起专注" />
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-5 py-4">
        {!activeOrSeen ? <FocusSetup tasks={availableTasks} taskId={taskId} title={title} notes={notes} duration={duration} mode={focusMode} busy={busy} onTaskChange={setTaskId} onTitleChange={setTitle} onNotesChange={setNotes} onDurationChange={setDuration} onModeChange={setFocusMode} onStart={() => void start()} /> : ended ? <FocusCompleted state={pomodoro} taskTitle={title || task?.title} hasTask={Boolean(task)} tasks={availableTasks} title={title} notes={notes} taskId={taskId} busy={busy} savedRecordCount={savedRecordCount} onTitleChange={setTitle} onNotesChange={setNotes} onTaskChange={setTaskId} onSave={() => void saveCompleted()} onCapture={() => setCaptureOpen(true)} onFinishTask={() => void finishTask()} onClose={closeCompleted} /> : <FocusRunning state={pomodoro} taskTitle={title || task?.title || '自由专注'} busy={busy} onRestart={() => void restart()} onTogglePause={() => void togglePause()} onComplete={() => void finish()} />}
        {(message || pomodoro.syncError) ? <p role="status" className={`w-full rounded-2xl px-4 py-3 text-sm ${message === '已保存专注内容' ? 'bg-[#eef6df] text-[#466326]' : 'bg-red-50 text-red-700'}`}>{message || pomodoro.syncError}</p> : null}
      </main>
      <InspirationCaptureSheet open={captureOpen} focusSessionId={pomodoro.lastCompletedSessionId || undefined} allowMedia={timeTrackingPreferences?.focusAttachmentEnabled === true} onClose={() => setCaptureOpen(false)} onSaved={() => setSavedRecordCount((count) => count + 1)} />
    </div>,
    document.body,
  );
}
