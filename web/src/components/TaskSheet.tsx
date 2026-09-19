import { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, CalendarClock, ChevronDown, ChevronUp, Clock3, X } from 'lucide-react';
import type { Task, TaskSection } from '../types';
import type { SaveParams } from './DarkFrostedModal';
import { useModalLifecycle } from './ui/useModalLifecycle';
import {
  getTaskSectionPlaceholder,
  presetTaskSections,
  readCustomTaskSections,
} from '../utils/taskSections';

type RepeatRule = 'none' | 'daily' | 'weekly' | 'monthly';

interface TaskSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (params: SaveParams) => void | Promise<void>;
  onPlanWithAI?: () => void;
}

const priorities: Array<{ value: Task['priority']; label: string }> = [
  { value: 'High Priority', label: '高' },
  { value: 'Medium', label: '中' },
  { value: 'Low', label: '低' },
];

const durations = [15, 30, 45, 60, 90, 120];

export default function TaskSheet({ open, onClose, onSave, onPlanWithAI }: TaskSheetProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [section, setSection] = useState<TaskSection>('personal');
  const [project, setProject] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('Medium');
  const [duration, setDuration] = useState<number | undefined>(30);
  const [dueDate, setDueDate] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [repeatRule, setRepeatRule] = useState<RepeatRule>('none');
  const [repeatStartDate, setRepeatStartDate] = useState('');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useModalLifecycle(open, onClose);

  const sections = useMemo(
    () => [
      ...presetTaskSections.map((item) => ({ value: item.key as TaskSection, label: item.shortLabel })),
      ...readCustomTaskSections().map((value) => ({ value: value as TaskSection, label: value })),
    ],
    [open],
  );

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setSection('personal');
    setProject('');
    setPriority('Medium');
    setDuration(30);
    setDueDate('');
    setScheduledStart('');
    setReminderAt('');
    setRepeatRule('none');
    setRepeatStartDate('');
    setRepeatEndDate('');
    setMoreOpen(false);
    setSaving(false);
  }, [open]);

  if (!open) return null;

  const buildParams = (): SaveParams => ({
    title: title.trim(),
    content: description.trim(),
    context: 'task',
    status: 'To do',
    priority,
    section,
    project: project.trim() || undefined,
    dueDate: dueDate || undefined,
    scheduledStart: scheduledStart || undefined,
    startTime: scheduledStart ? scheduledStart.split('T')[1]?.slice(0, 5) : undefined,
    reminderAt: reminderAt || undefined,
    repeatRule: repeatRule === 'none' ? undefined : repeatRule,
    repeatStartDate: repeatRule === 'none' ? undefined : (repeatStartDate || undefined),
    repeatEndDate: repeatRule === 'none' ? undefined : (repeatEndDate || undefined),
    duration,
  });

  const submit = async (planAfterSave = false) => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(buildParams());
      onClose();
      if (planAfterSave) onPlanWithAI?.();
    } finally {
      setSaving(false);
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
        aria-label="新建任务"
        className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-[var(--sf-surface)] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-5 shadow-2xl animate-slide-up-sheet"
      >
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sf-text-tertiary)]">Task</p>
            <h2 className="mt-1 text-xl font-black text-[var(--sf-text-primary)]">新建任务</h2>
            <p className="mt-1 text-xs text-[var(--sf-text-tertiary)]">先写清要做什么，其余信息需要时再补。</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--sf-bg)]" aria-label="关闭">
            <X size={16} />
          </button>
        </header>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[var(--sf-text-secondary)]">任务</span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：完成民法案例分析"
              className="w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm font-semibold text-[var(--sf-text-primary)] outline-none focus:border-[var(--sf-text-primary)]"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[var(--sf-text-secondary)]">补充说明</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="写下要求、材料、上下文或你不想忘记的细节"
              className="min-h-24 w-full resize-none rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--sf-text-primary)]"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1.5 block text-xs font-bold text-[var(--sf-text-secondary)]">分组</span>
              <select
                value={section}
                onChange={(event) => setSection(event.target.value as TaskSection)}
                className="w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-3 text-sm outline-none"
              >
                {sections.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-bold text-[var(--sf-text-secondary)]">项目 / 文件夹</span>
              <input
                value={project}
                onChange={(event) => setProject(event.target.value)}
                placeholder={getTaskSectionPlaceholder(section)}
                className="w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-3 text-sm outline-none"
              />
            </label>
          </div>

          <div>
            <span className="mb-2 block text-xs font-bold text-[var(--sf-text-secondary)]">优先级</span>
            <div className="grid grid-cols-3 gap-2">
              {priorities.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPriority(item.value)}
                  className={`rounded-full px-3 py-2 text-xs font-bold transition-colors ${priority === item.value ? 'bg-[#242424] text-white' : 'bg-[var(--sf-bg)] text-[var(--sf-text-secondary)]'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[var(--sf-text-secondary)]"><Clock3 size={13} />预计时长</span>
            <div className="flex flex-wrap gap-2">
              {durations.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDuration(value)}
                  className={`rounded-full px-3 py-2 text-xs font-bold ${duration === value ? 'bg-[#cae393] text-[#242424]' : 'bg-[var(--sf-bg)] text-[var(--sf-text-secondary)]'}`}
                >
                  {value >= 60 ? `${value / 60}h` : `${value}m`}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--sf-text-secondary)]"><CalendarClock size={13} />截止时间</span>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
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

        <div className="sticky bottom-0 mt-5 grid grid-cols-[1fr_1.25fr] gap-2 bg-[var(--sf-surface)] pt-3">
          <button
            type="button"
            disabled={!title.trim() || saving}
            onClick={() => void submit(false)}
            className="rounded-full bg-[var(--sf-bg)] py-3 text-sm font-bold text-[var(--sf-text-primary)] disabled:opacity-40"
          >
            {saving ? '保存中…' : '保存任务'}
          </button>
          <button
            type="button"
            disabled={!title.trim() || saving}
            onClick={() => void submit(true)}
            className="flex items-center justify-center gap-2 rounded-full bg-[#242424] py-3 text-sm font-black text-[#cae393] disabled:opacity-40"
          >
            <BrainCircuit size={16} /> 保存并交给 AI 安排
          </button>
        </div>
      </section>
    </div>
  );
}
