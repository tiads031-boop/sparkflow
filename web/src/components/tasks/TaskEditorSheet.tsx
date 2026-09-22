import { useEffect, useState } from 'react';
import { BrainCircuit, CalendarClock, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { Task, TaskSection } from '../../types';
import type { SaveParams } from '../DarkFrostedModal';
import { useModalLifecycle } from '../ui/useModalLifecycle';
import { readUserPreferences } from '../../utils/userPreferences';
import { presetTaskSections, readCustomTaskSections } from '../../utils/taskSections';
import TagSelector from '../tags/TagSelector';
import { BottomActionBar, DangerAction, SectionCard } from '../ui/foundation';
import { fetchStudyFolders } from '../../api/study';
import type { StudyFolder } from '../../types';
import TaskDetailsForm from './TaskDetailsForm';
import TaskQuickUpdate from './TaskQuickUpdate';
import TaskSummaryCard from './TaskSummaryCard';
import { localTaskDate, localTaskDateTime, type RepeatRule } from './taskEditorModel';

interface TaskEditorSheetProps {
  open: boolean;
  task?: Task | null;
  onClose: () => void;
  onSave: (params: SaveParams) => void | Promise<void>;
  onDelete?: (taskId: string) => void | Promise<void>;
  onPlanWithAI?: () => void;
}

export default function TaskEditorSheet({ open, task, onClose, onSave, onDelete, onPlanWithAI }: TaskEditorSheetProps) {
  const editing = Boolean(task);
  const [title, setTitle] = useState(() => task?.title || '');
  const [description, setDescription] = useState(() => task?.description || '');
  const [status, setStatus] = useState<Task['status']>(() => task?.status || 'To do');
  const [section, setSection] = useState<TaskSection>(() => task?.section || 'personal');
  const [project, setProject] = useState(() => task?.project || '');
  const [tags, setTags] = useState<string[]>(() => task?.tags || []);
  const [studyFolderId, setStudyFolderId] = useState(() => task?.studyFolderId || '');
  const [studyFolders, setStudyFolders] = useState<StudyFolder[]>([]);
  const [priority, setPriority] = useState<Task['priority']>(() => task?.priority || 'Medium');
  const [duration, setDuration] = useState<number | undefined>(() => task?.estimatedMinutes || task?.duration || 30);
  const [dueDate, setDueDate] = useState(() => localTaskDateTime(task?.dueDate));
  const [scheduledStart, setScheduledStart] = useState(() => localTaskDateTime(task?.scheduledStart));
  const [reminderAt, setReminderAt] = useState(() => localTaskDateTime(task?.reminderAt || undefined));
  const [repeatRule, setRepeatRule] = useState<RepeatRule>(() => task?.repeatRule === 'daily' || task?.repeatRule === 'weekly' || task?.repeatRule === 'monthly' ? task.repeatRule : 'none');
  const [repeatStartDate, setRepeatStartDate] = useState(() => localTaskDate(task?.repeatStartDate));
  const [repeatEndDate, setRepeatEndDate] = useState(() => localTaskDate(task?.repeatEndDate));
  const [moreOpen, setMoreOpen] = useState(() => Boolean(
    task?.scheduledStart || task?.reminderAt || task?.repeatRule,
  ));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalLifecycle(open, onClose);

  const [sections] = useState(() => [
      ...presetTaskSections.map((item) => ({ value: item.key as TaskSection, label: item.shortLabel })),
      ...readCustomTaskSections().map((value) => ({ value: value as TaskSection, label: value })),
    ]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchStudyFolders().then((folders) => { if (active) setStudyFolders(folders); }).catch(() => { if (active) setStudyFolders([]); });
    return () => { active = false; };
  }, [open]);

  if (!open) return null;

  const buildParams = (): SaveParams => ({
    id: task?.id,
    title: title.trim(),
    content: description.trim(),
    context: 'task',
    status,
    priority,
    section,
    project: project.trim() || undefined,
    tags,
    studyFolderId: studyFolderId || undefined,
    dueDate: dueDate || undefined,
    scheduledStart: scheduledStart || undefined,
    startTime: scheduledStart ? scheduledStart.split('T')[1]?.slice(0, 5) : undefined,
    reminderAt: reminderAt || undefined,
    repeatRule: repeatRule === 'none' ? undefined : repeatRule,
    repeatStartDate: repeatRule === 'none' ? undefined : (repeatStartDate || undefined),
    repeatEndDate: repeatRule === 'none' ? undefined : (repeatEndDate || undefined),
    duration,
    subtasks: task?.subtasks,
  });

  const submit = async (planAfterSave = false) => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(buildParams());
      onClose();
      if (planAfterSave) onPlanWithAI?.();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async () => {
    if (!task || !onDelete || deleting || !window.confirm(`删除“${task.title}”？`)) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(task.id);
      onClose();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '删除失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/30"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={editing ? '编辑任务' : '新建任务'}
        className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-[var(--sf-surface)] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-5 shadow-2xl animate-slide-up-sheet"
      >
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sf-text-tertiary)]">Task</p>
            <h2 className="mt-1 text-xl font-black text-[var(--sf-text-primary)]">{editing ? '编辑任务' : '新建任务'}</h2>
            <p className="mt-1 text-xs text-[var(--sf-text-tertiary)]">创建与编辑共用同一套字段和保存逻辑。</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--sf-bg)]" aria-label="关闭">
            <X size={16} />
          </button>
        </header>

        <div className="space-y-4">
          <TaskSummaryCard title={title} description={description} section={section} project={project} tags={tags} onTitleChange={setTitle} onDescriptionChange={setDescription} />

          <TaskDetailsForm section={section} project={project} studyFolderId={studyFolderId} sections={sections} studyFolders={studyFolders} onSectionChange={setSection} onProjectChange={setProject} onStudyFolderChange={setStudyFolderId} />

          <SectionCard>
            <TagSelector value={tags} onChange={setTags} />
          </SectionCard>

          <TaskQuickUpdate editing={editing} status={status} priority={priority} duration={duration} onStatusChange={setStatus} onPriorityChange={setPriority} onDurationChange={setDuration} />

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--sf-text-secondary)]"><CalendarClock size={13} />截止时间</span>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(event) => {
                const value = event.target.value;
                setDueDate(value);
                if (!reminderAt && value) {
                  const lead = readUserPreferences().defaultReminderMinutes;
                  if (lead > 0) {
                    const due = new Date(value);
                    if (!Number.isNaN(due.getTime())) {
                      const reminder = new Date(due.getTime() - lead * 60_000);
                      const local = `${reminder.getFullYear()}-${String(reminder.getMonth() + 1).padStart(2, '0')}-${String(reminder.getDate()).padStart(2, '0')}T${String(reminder.getHours()).padStart(2, '0')}:${String(reminder.getMinutes()).padStart(2, '0')}`;
                      setReminderAt(local);
                    }
                  }
                }
              }}
              className="w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className="flex w-full items-center justify-between rounded-2xl bg-[var(--sf-bg)] px-4 py-3 text-sm font-bold text-[var(--sf-text-secondary)]"
          >
            更多设置
            {moreOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {moreOpen && (
            <div className="space-y-4 rounded-2xl border border-[var(--sf-border)] p-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[var(--sf-text-secondary)]">指定开始时间</span>
                <input
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(event) => setScheduledStart(event.target.value)}
                  className="w-full rounded-xl bg-[var(--sf-bg)] px-3 py-2.5 text-sm outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[var(--sf-text-secondary)]">提醒时间</span>
                <input
                  type="datetime-local"
                  value={reminderAt}
                  onChange={(event) => setReminderAt(event.target.value)}
                  className="w-full rounded-xl bg-[var(--sf-bg)] px-3 py-2.5 text-sm outline-none"
                />
              </label>
              <div>
                <span className="mb-2 block text-xs font-bold text-[var(--sf-text-secondary)]">重复</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    ['none', '不重复'],
                    ['daily', '每天'],
                    ['weekly', '每周'],
                    ['monthly', '每月'],
                  ] as Array<[RepeatRule, string]>).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => setRepeatRule(value)}
                      className={`rounded-xl px-2 py-2 text-[10px] font-bold ${repeatRule === value ? 'bg-[#b0a8db] text-[#242424]' : 'bg-[var(--sf-bg)] text-[var(--sf-text-secondary)]'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {repeatRule !== 'none' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input type="date" value={repeatStartDate} onChange={(event) => setRepeatStartDate(event.target.value)} className="rounded-xl bg-[var(--sf-bg)] px-3 py-2.5 text-xs outline-none" />
                    <input type="date" value={repeatEndDate} onChange={(event) => setRepeatEndDate(event.target.value)} className="rounded-xl bg-[var(--sf-bg)] px-3 py-2.5 text-xs outline-none" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</p>}

        <BottomActionBar>
        {editing && task && onDelete && (
          <div className="mb-2 flex justify-end">
            <DangerAction onClick={() => void removeTask()} disabled={deleting || saving}>{deleting ? '删除中…' : '删除任务'}</DangerAction>
          </div>
        )}
        <div className="grid grid-cols-[1fr_1.25fr] gap-2">
          <button
            type="button"
            disabled={!title.trim() || saving || deleting}
            onClick={() => void submit(false)}
            className="rounded-full bg-[var(--sf-bg)] py-3 text-sm font-bold text-[var(--sf-text-primary)] disabled:opacity-40"
          >
            {saving ? '保存中…' : editing ? '保存修改' : '保存任务'}
          </button>
          <button
            type="button"
            disabled={!title.trim() || saving || deleting}
            onClick={() => void submit(true)}
            className="flex items-center justify-center gap-2 rounded-full bg-[#242424] py-3 text-sm font-black text-[#cae393] disabled:opacity-40"
          >
            <BrainCircuit size={16} /> 保存并交给 AI 安排
          </button>
        </div>
        </BottomActionBar>
      </section>
    </div>
  );
}
