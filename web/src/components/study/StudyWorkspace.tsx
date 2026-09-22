import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Clock3,
  Focus,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { StudyFolder, StudyFolderInput, Task } from '../../types';
import {
  archiveStudyFolder,
  createStudyFolder,
  fetchStudyFolders,
  restoreStudyFolder,
  updateStudyFolder,
} from '../../api/study';
import PlannerSheet from '../planner/PlannerSheet';
import GoalProgressPanel from './GoalProgressPanel';
import StudyCourseWorkspace from './StudyCourseWorkspace';
import StudySurfaceSwitch, { type StudySurface } from './StudySurfaceSwitch';

const goalColors = ['#cae393', '#b0a8db', '#f5c98b', '#8fd6cf', '#f4a6b8'];

function isSameLocalDay(value: string | undefined, today: Date) {
  if (!value) return false;
  const date = new Date(value);
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function isDone(task: Task) {
  return task.status === 'Done' || task.status === 'Cancelled';
}

function goalProgress(goal: StudyFolder) {
  const relevantTasks = goal.tasks.filter((task) => task.status !== 'Cancelled');
  const total = relevantTasks.length;
  const done = relevantTasks.filter((task) => task.status === 'Done').length;
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

function goalMilestones(goal: StudyFolder) {
  const groups = new Map<string, Task[]>();
  for (const task of goal.tasks.filter((item) => item.status !== 'Cancelled')) {
    const title = task.project?.trim() || '待整理';
    const current = groups.get(title) || [];
    current.push(task);
    groups.set(title, current);
  }

  return [...groups.entries()].map(([title, tasks]) => {
    const sortedTasks = [...tasks].sort((a, b) => {
      if (isDone(a) !== isDone(b)) return isDone(a) ? 1 : -1;
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });
    const done = tasks.filter(isDone).length;
    const dueDates = tasks.map((task) => task.dueDate).filter((value): value is string => Boolean(value));
    return {
      title,
      tasks: sortedTasks,
      done,
      total: tasks.length,
      nextDue: dueDates.sort()[0],
    };
  }).sort((a, b) => {
    if (a.title === '待整理') return 1;
    if (b.title === '待整理') return -1;
    return (a.nextDue || '9999').localeCompare(b.nextDue || '9999');
  });
}

function planningSeed(goal: StudyFolder) {
  const background = goal.description?.trim()
    ? `我目前补充的背景是：${goal.description.trim()}。`
    : '';
  return `我想把“${goal.name}”作为一个长期学习目标。${background}请先尽可能了解我的成功标准、当前水平、可用资源、每周时间预算、偏好和取舍；如果计划依赖考试时间、报名规则、官方大纲、目标要求或资源版本，请先联网核实。不要急着一次性给完计划，先从高影响问题开始了解我；信息足够后，请按阶段/里程碑拆成可执行任务。`;
}

function GoalDialog({
  goal,
  onClose,
  onSave,
}: {
  goal: StudyFolder | null;
  onClose: () => void;
  onSave: (input: StudyFolderInput) => Promise<void>;
}) {
  const [name, setName] = useState(goal?.name || '');
  const [description, setDescription] = useState(goal?.description || '');
  const [color, setColor] = useState(goal?.color || goalColors[0]);
  const [progressType, setProgressType] = useState(goal?.progressType || 'task');
  const [targetValue, setTargetValue] = useState(
    goal?.targetValue === null || goal?.targetValue === undefined
      ? ''
      : String(goal.targetValue),
  );
  const [progressUnit, setProgressUnit] = useState(goal?.progressUnit || '项');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-[105] flex items-end justify-center bg-black/30 px-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={goal ? '编辑学习目标' : '新建学习目标'}
    >
      <form
        className="mb-[env(safe-area-inset-bottom,0px)] max-h-[88svh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem]"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim() || saving) return;
          const parsedTarget = targetValue.trim() ? Number(targetValue) : null;
          if (
            progressType !== 'task'
            && parsedTarget !== null
            && (!Number.isFinite(parsedTarget) || parsedTarget <= 0)
          ) {
            setError('目标值需要是大于 0 的数字');
            return;
          }
          setSaving(true);
          setError(null);
          try {
            await onSave({
              name: name.trim(),
              description: description.trim() || null,
              color,
              taskIds: goal?.tasks.map((task) => task.id),
              progressType,
              targetValue: progressType === 'task' ? null : parsedTarget,
              progressUnit: progressType === 'numeric'
                ? progressUnit.trim() || '项'
                : progressType === 'time' ? '分钟' : null,
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : '保存失败');
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7b6eae]">
              Learning Goal
            </p>
            <h2 className="mt-1 text-xl font-black text-[#242424]">
              {goal ? '编辑学习目标' : '你想学会什么？'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              {goal
                ? '这里只改目标本身；AI 规划上下文和已有任务会继续保留。'
                : '先给目标一个方向，创建后 AI 会继续追问成功标准、当前水平、时间预算和资源。'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f4f4f6] text-gray-500"
            aria-label="关闭"
          >
            <X size={17} />
          </button>
        </div>

        <label className="block text-xs font-bold text-[#242424]">
          目标
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            required
            placeholder="例如：通过 2027 年法考"
            className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm outline-none ring-2 ring-transparent focus:ring-[#cae393]"
          />
        </label>

        <label className="mt-4 block text-xs font-bold text-[#242424]">
          你现在已经知道的情况
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="例如：目前刚开始准备，工作日晚上有 1 小时，周末时间更多。不了解的信息可以留给 AI 继续问。"
            className="mt-1 w-full resize-none rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm leading-6 outline-none ring-2 ring-transparent focus:ring-[#cae393]"
          />
        </label>

        <div className="mt-4">
          <p className="mb-2 text-xs font-bold text-[#242424]">目标颜色</p>
          <div className="flex gap-2">
            {goalColors.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setColor(item)}
                aria-label={`选择颜色 ${item}`}
                className={`h-8 w-8 rounded-full border-2 ${color === item ? 'border-[#242424]' : 'border-white'}`}
                style={{ backgroundColor: item }}
              />
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-bold text-[#242424]">如何衡量进度</p>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#f4f4f6] p-1">
            {([
              ['task', '按任务'],
              ['numeric', '按数值'],
              ['time', '按专注'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setProgressType(value)}
                className={`rounded-xl px-2 py-2 text-[11px] font-black ${progressType === value ? 'bg-white text-[#242424] shadow-sm' : 'text-gray-400'}`}
                aria-pressed={progressType === value}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-gray-400">
            {progressType === 'task'
              ? '按已完成任务计算，取消任务不计入总数。'
              : progressType === 'time'
                ? '有效专注会自动累计，目标值使用分钟。'
                : '通过手工增减记录累计，例如读完 5 本、完成 200 题。'}
          </p>
        </div>

        {progressType !== 'task' && (
          <div className={`mt-4 grid gap-3 ${progressType === 'numeric' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <label className="block text-xs font-bold text-[#242424]">
              目标值（可稍后设置）
              <input
                type="number"
                min="0"
                step="any"
                value={targetValue}
                onChange={(event) => setTargetValue(event.target.value)}
                placeholder={progressType === 'time' ? '例如 2000' : '例如 48'}
                className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm outline-none ring-2 ring-transparent focus:ring-[#cae393]"
              />
            </label>
            {progressType === 'numeric' && (
              <label className="block text-xs font-bold text-[#242424]">
                单位
                <input
                  value={progressUnit}
                  onChange={(event) => setProgressUnit(event.target.value)}
                  maxLength={30}
                  placeholder="本 / 题 / 字"
                  className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm outline-none ring-2 ring-transparent focus:ring-[#cae393]"
                />
              </label>
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#242424] py-3 text-sm font-black text-[#cae393] disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <BrainCircuit size={15} />}
          {goal ? '保存目标' : '创建并和 AI 一起规划'}
        </button>
      </form>
    </div>
  );
}

function GoalCard({
  goal,
  onOpen,
  onPlan,
  onEdit,
  onArchive,
}: {
  goal: StudyFolder;
  onOpen: () => void;
  onPlan: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const progress = goalProgress(goal);
  const milestones = goalMilestones(goal);

  return (
    <article
      className="rounded-[1.7rem] border border-black/[0.05] p-4 shadow-sm"
      style={{ backgroundColor: `${goal.color}20` }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[#242424]"
          style={{ backgroundColor: goal.color }}
          aria-label="查看学习路线"
        >
          <Target size={19} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
              <h3 className="truncate text-sm font-black text-[#242424]">{goal.name}</h3>
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-gray-500">
                {goal.description || '还没有补充背景，AI 会在规划时继续了解。'}
              </p>
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/80 text-gray-500"
              aria-label="编辑目标"
            >
              <Pencil size={13} />
            </button>
          </div>

          <div className="mt-3">
            {progress.total === 0 ? (
              <p className="text-[9px] font-bold text-gray-500">尚未关联执行任务</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-[9px] font-bold text-gray-400">
                  <span>{progress.done}/{progress.total} 个执行任务已完成</span>
                  <span>{progress.percent}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/80">
                  <div
                    className="h-full rounded-full bg-[#242424] transition-[width]"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-bold">
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-gray-500">
              {milestones.filter((item) => item.title !== '待整理').length} 个阶段
            </span>
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-gray-500">
              {progress.total} 个有效任务
            </span>
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-gray-500">
              {goal.planningThread
                ? `AI r${goal.planningThread.revision} · ${goal.planningThread.conversationCount} 轮`
                : '尚未建立 AI 规划'}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpen}
            className="mt-3 text-[10px] font-black text-[#655a90]"
          >
            查看学习路线 →
          </button>
        </div>
      </div>

      <div className={`mt-4 grid gap-2 ${goal.status === 'archived' ? 'grid-cols-1' : 'grid-cols-[1fr_auto]'}`}>
        {goal.status !== 'archived' && (
          <button
            type="button"
            onClick={onPlan}
            className="flex items-center justify-center gap-2 rounded-full bg-[#242424] py-2.5 text-xs font-black text-[#cae393]"
          >
            <Sparkles size={13} />
            {goal.planningThread ? '继续和 AI 规划' : '开始 AI 规划'}
          </button>
        )}
        <button
          type="button"
          onClick={onArchive}
          className={`${goal.status === 'archived' ? 'flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold' : 'grid h-10 w-10 place-items-center rounded-full'} bg-white/80 text-gray-500`}
          aria-label={goal.status === 'archived' ? '恢复目标' : '归档目标'}
        >
          {goal.status === 'archived'
            ? <><RotateCcw size={14} />恢复目标</>
            : <Archive size={14} />}
        </button>
      </div>
    </article>
  );
}

function GoalRoadmap({
  goal,
  onBack,
  onEdit,
  onPlan,
  onStartFocus,
}: {
  goal: StudyFolder;
  onBack: () => void;
  onEdit: () => void;
  onPlan: (seed?: string) => void;
  onStartFocus: () => void;
}) {
  const milestones = goalMilestones(goal);

  return (
    <div className="animate-page-enter pb-24">
      <header className="mb-4 flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-sm"
          aria-label="返回学习目标"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7b6eae]">
            Learning Roadmap
          </p>
          <h1 className="mt-1 truncate text-xl font-black text-[#242424]">{goal.name}</h1>
        </div>
      </header>

      <GoalProgressPanel
        key={`${goal.id}:${goal.progressType}:${goal.targetValue}:${goal.progressUnit}`}
        goal={goal}
        onEdit={onEdit}
      />

      {goal.status === 'active' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPlan()}
            className="flex items-center justify-center gap-2 rounded-full bg-[#242424] py-2.5 text-xs font-black text-[#cae393]"
          >
            <BrainCircuit size={13} /> 继续 AI 规划
          </button>
          <button
            type="button"
            onClick={onStartFocus}
            className="flex items-center justify-center gap-2 rounded-full bg-white py-2.5 text-xs font-bold text-gray-600 shadow-sm"
          >
            <Focus size={13} /> 开始专注
          </button>
        </div>
      )}

      {goal.status === 'active' && (
        <section className="mt-4 rounded-[1.8rem] border border-[#b0a8db]/35 bg-[#f7f5fc] p-4">
          <div className="flex items-start gap-2">
            <BrainCircuit size={16} className="mt-0.5 shrink-0 text-[#6f63a8]" />
            <div>
              <h2 className="text-sm font-black text-[#3f385f]">根据实际执行继续调整</h2>
              <p className="mt-1 text-[10px] leading-4 text-[#756f8d]">
                AI 会读取这个目标真实的任务完成、逾期、近 7 天专注和各阶段进度；这些数据只用于判断节奏，不会把“做完任务”直接当成“已经掌握”。
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => onPlan('请结合这个学习目标当前的实际执行快照，帮我做一次复盘。先指出计划与执行之间最值得关注的偏差，再问我造成这些偏差的关键原因；不要因为进度落后就直接增加任务。')}
              className="rounded-2xl bg-white px-4 py-3 text-left"
            >
              <strong className="block text-xs text-[#3f385f]">复盘实际执行</strong>
              <span className="mt-1 block text-[10px] leading-4 text-gray-400">完成率、逾期、专注时间和阶段推进一起看。</span>
            </button>
            <button
              type="button"
              onClick={() => onPlan('我觉得当前学习路线需要调整。请先结合实际执行情况判断问题更可能出在时间预算、难度、任务拆分还是策略上，再向我追问必要信息，最后给出可确认的任务或阶段调整草案。')}
              className="rounded-2xl bg-white px-4 py-3 text-left"
            >
              <strong className="block text-xs text-[#3f385f]">调整学习路线</strong>
              <span className="mt-1 block text-[10px] leading-4 text-gray-400">保留仍有效的目标与约束，只改真正需要变的部分。</span>
            </button>
            <button
              type="button"
              onClick={() => onPlan('我的学习目标本身可能发生了变化。请先问清楚我想保留什么、放弃什么以及新的成功标准；只有我明确确认目标变化后，再提出“修改学习目标”的可确认草案，并同步检查现有阶段和任务是否需要调整。')}
              className="rounded-2xl bg-white px-4 py-3 text-left"
            >
              <strong className="block text-xs text-[#3f385f]">目标发生变化</strong>
              <span className="mt-1 block text-[10px] leading-4 text-gray-400">换目标不会直接覆盖，仍需要你确认 AI 的修改草案。</span>
            </button>
          </div>
        </section>
      )}

      <section className="mt-4 rounded-[2rem] bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-black text-[#242424]">阶段 / 里程碑</h2>
          <p className="mt-1 text-[10px] leading-4 text-gray-400">
            阶段来自 AI 任务草案的 milestoneTitle，落库时复用 Task.project；这里不复制 Task 数据。
          </p>
        </div>

        {milestones.length ? (
          <div className="space-y-4">
            {milestones.map((milestone, index) => (
              <article
                key={milestone.title}
                className="rounded-[1.5rem] border border-black/[0.05] bg-[#fafafa] p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e5e2f3] text-[10px] font-black text-[#5a4f86]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-black text-[#242424]">{milestone.title}</h3>
                        <p className="mt-0.5 text-[9px] text-gray-400">
                          {milestone.done}/{milestone.total} 完成
                          {milestone.nextDue
                            ? ` · 最近截止 ${new Date(milestone.nextDue).toLocaleDateString('zh-CN')}`
                            : ''}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-gray-400">
                        {milestone.total ? Math.round((milestone.done / milestone.total) * 100) : 0}%
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {milestone.tasks.map((task) => (
                        <div
                          key={task.id}
                          className={`flex items-start gap-2 rounded-2xl bg-white px-3 py-2.5 ${isDone(task) ? 'opacity-50' : ''}`}
                        >
                          {isDone(task)
                            ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#87a54d]" />
                            : <Circle size={14} className="mt-0.5 shrink-0 text-gray-300" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#242424]">{task.title}</p>
                            <p className="mt-0.5 text-[9px] text-gray-400">
                              {task.estimatedMinutes || task.duration
                                ? `${task.estimatedMinutes || task.duration} 分钟`
                                : '未设置时长'}
                              {task.dueDate
                                ? ` · 截止 ${new Date(task.dueDate).toLocaleDateString('zh-CN')}`
                                : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.5rem] bg-[#f4f4f6] px-5 py-8 text-center">
            <Sparkles size={20} className="mx-auto text-[#8b7fbc]" />
            <p className="mt-3 text-sm font-black text-[#242424]">还没有形成学习路线</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-gray-400">
              和 AI 把成功标准、当前水平与时间预算聊清楚后，让它按阶段生成可确认的任务。
            </p>
            {goal.status === 'active' && (
              <button
                type="button"
                onClick={() => onPlan()}
                className="mt-4 rounded-full bg-[#242424] px-4 py-2.5 text-xs font-black text-[#cae393]"
              >
                继续完善目标
              </button>
            )}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-[1.6rem] border border-dashed border-[#b0a8db]/50 bg-[#f7f5fc] p-4">
        <p className="text-xs font-bold text-[#4f4675]">持续规划上下文</p>
        <p className="mt-1 text-[10px] leading-4 text-[#756f8d]">
          {goal.planningThread
            ? `当前 revision ${goal.planningThread.revision}，已进行 ${goal.planningThread.conversationCount} 轮规划对话。后续调整会继续沿用仍有效的目标、约束、偏好、策略和外部依据。`
            : '这个目标还没有 Planning Context。开始 AI 规划后会建立并持续复用。'}
        </p>
      </section>
    </div>
  );
}

export default function StudyWorkspace({
  onStartFocus,
  initialSurface = 'goals',
  initialCourseId = null,
}: {
  onStartFocus: () => void;
  initialSurface?: StudySurface;
  initialCourseId?: string | null;
}) {
  const loadTasks = useAppStore((state) => state.loadTasks);
  const todayCount = useAppStore((state) => state.pomodoro.todayCount);
  const totalFocusMinutes = useAppStore((state) => state.pomodoro.totalFocusMinutes);

  const [surface, setSurface] = useState<StudySurface>(() => initialSurface);
  const [goals, setGoals] = useState<StudyFolder[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<StudyFolder | null | undefined>(undefined);
  const [planningGoal, setPlanningGoal] = useState<StudyFolder | null>(null);
  const [plannerSeed, setPlannerSeed] = useState('');
  const [roadmapGoalId, setRoadmapGoalId] = useState<string | null>(null);

  const loadGoals = async () => {
    setLoading(true);
    setError(null);
    try {
      setGoals(await fetchStudyFolders('all'));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载学习目标失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void fetchStudyFolders('all')
      .then((items) => {
        if (active) setGoals(items);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : '加载学习目标失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const visibleGoals = goals.filter((goal) => (
    showArchived ? goal.status === 'archived' : goal.status === 'active'
  ));
  const roadmapGoal = roadmapGoalId
    ? goals.find((goal) => goal.id === roadmapGoalId) || null
    : null;

  const todayTasks = useMemo(() => {
    const today = new Date();
    const byId = new Map<string, Task>();
    for (const goal of activeGoals) {
      for (const task of goal.tasks) {
        if (
          !isDone(task) &&
          (isSameLocalDay(task.scheduledStart, today) || isSameLocalDay(task.dueDate, today))
        ) {
          byId.set(task.id, task);
        }
      }
    }
    return [...byId.values()].sort((a, b) => {
      const aTime = a.scheduledStart || a.dueDate || '';
      const bTime = b.scheduledStart || b.dueDate || '';
      return aTime.localeCompare(bTime);
    });
  }, [activeGoals]);

  const openGoalPlanning = (goal: StudyFolder, seed?: string) => {
    setPlannerSeed(seed ?? (goal.planningThread ? '' : planningSeed(goal)));
    setPlanningGoal(goal);
  };

  const saveGoal = async (input: StudyFolderInput) => {
    if (editingGoal) {
      await updateStudyFolder(editingGoal.id, input);
      setEditingGoal(undefined);
      await loadGoals();
      return;
    }

    const created = await createStudyFolder({
      name: input.name,
      description: input.description,
      color: input.color,
      icon: 'target',
      taskIds: [],
      progressType: input.progressType,
      targetValue: input.targetValue,
      progressUnit: input.progressUnit,
    });
    setEditingGoal(undefined);
    await loadGoals();
    openGoalPlanning(created, planningSeed(created));
  };

  const toggleArchive = async (goal: StudyFolder) => {
    try {
      if (goal.status === 'archived') await restoreStudyFolder(goal.id);
      else await archiveStudyFolder(goal.id);
      if (planningGoal?.id === goal.id) setPlanningGoal(null);
      await loadGoals();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新学习目标失败');
    }
  };

  const handlePlannerApplied = async () => {
    await loadTasks();
    await loadGoals();
  };

  return (
    <>
      {!roadmapGoal ? <StudySurfaceSwitch value={surface} onChange={setSurface} /> : null}
      {roadmapGoal ? (
        <GoalRoadmap
          goal={roadmapGoal}
          onBack={() => setRoadmapGoalId(null)}
          onEdit={() => setEditingGoal(roadmapGoal)}
          onPlan={(seed) => openGoalPlanning(roadmapGoal, seed)}
          onStartFocus={onStartFocus}
        />
      ) : surface === 'courses' ? (
        <div className="animate-page-enter pb-24">
          <StudyCourseWorkspace initialCourseId={initialCourseId} />
        </div>
      ) : (
        <div className="animate-page-enter pb-24">
          <header className="mb-5 rounded-[2rem] bg-[#242424] p-5 text-white shadow-sm">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#cae393]">
                  AI Learning Goals
                </p>
                <h1 className="mt-1 text-2xl font-black">学习，不再从“选一门课”开始。</h1>
                <p className="mt-2 max-w-md text-xs leading-5 text-white/60">
                  先说清你想达到什么。AI 会持续了解你的现状和约束，必要时联网核实，再把目标拆成阶段、任务与真实时间安排。
                </p>
              </div>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#cae393] text-[#242424]">
                <GraduationCap size={21} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-[1.35fr_1fr] gap-2">
              <button
                type="button"
                onClick={() => setEditingGoal(null)}
                className="flex items-center justify-center gap-2 rounded-full bg-[#cae393] py-3 text-sm font-black text-[#242424] active:scale-[0.99]"
              >
                <Plus size={15} /> 新学习目标
              </button>
              <button
                type="button"
                onClick={onStartFocus}
                className="flex items-center justify-center gap-2 rounded-full bg-white/10 py-3 text-sm font-black text-white active:scale-[0.99]"
              >
                <Focus size={15} /> 开始专注
              </button>
            </div>
          </header>

          {error && (
            <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
              {error}
              <button type="button" onClick={() => void loadGoals()} className="ml-2 font-bold underline">
                重新加载
              </button>
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-[1.6rem] bg-white p-4 shadow-sm">
              <Target size={17} className="text-[#8b7fbc]" />
              <p className="mt-3 text-2xl font-black text-[#242424]">
                {error && goals.length === 0 ? '—' : activeGoals.length}
              </p>
              <p className="text-[10px] text-gray-400">进行中的学习目标</p>
            </div>
            <div className="rounded-[1.6rem] bg-[#e5e2f3] p-4 shadow-sm">
              <Clock3 size={17} className="text-[#5a4f86]" />
              <p className="mt-3 text-2xl font-black text-[#242424]">
                {totalFocusMinutes}
                <span className="ml-1 text-xs text-gray-500">分钟</span>
              </p>
              <p className="text-[10px] text-gray-500">累计专注 · 今日 {todayCount} 次</p>
            </div>
          </div>

          <section className="mb-4 rounded-[2rem] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-[#242424]">今天的学习执行</h2>
                <p className="mt-0.5 text-[10px] text-gray-400">只来自学习目标里的共享 Task，不再混入课程。</p>
              </div>
              <CheckCircle2 size={18} className="text-[#8b7fbc]" />
            </div>

            <div className="space-y-2">
              {todayTasks.length ? todayTasks.slice(0, 6).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-2xl bg-[#f4f4f6] px-3 py-3"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[#cae393]" />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#242424]">
                    {task.title}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {task.estimatedMinutes || task.duration || 25} 分钟
                  </span>
                </div>
              )) : (
                <p className="rounded-2xl bg-[#f4f4f6] px-4 py-6 text-center text-xs leading-5 text-gray-400">
                  今天还没有来自学习目标的执行任务。进入任一目标与 AI 继续规划，确认后的任务会出现在这里。
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-[#242424]">
                  {showArchived ? '已归档目标' : '学习目标'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowArchived((value) => !value)}
                  className="mt-1 text-[10px] font-bold text-[#8b7fbc]"
                >
                  {showArchived ? '返回进行中目标' : '查看已归档目标'}
                </button>
              </div>
              {!showArchived && (
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="flex items-center gap-1 rounded-full bg-[#242424] px-3 py-2 text-xs font-bold text-[#cae393]"
                >
                  <Plus size={13} /> 新建
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-gray-400" />
              </div>
            ) : error && goals.length === 0 ? null : (
              <div className="space-y-3">
                {visibleGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onOpen={() => setRoadmapGoalId(goal.id)}
                    onPlan={() => openGoalPlanning(goal)}
                    onEdit={() => setEditingGoal(goal)}
                    onArchive={() => void toggleArchive(goal)}
                  />
                ))}

                {!visibleGoals.length && (
                  <div className="rounded-[1.6rem] bg-[#f4f4f6] px-5 py-10 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white">
                      <Target size={20} className="text-[#8b7fbc]" />
                    </div>
                    <p className="mt-3 text-sm font-black text-[#242424]">
                      {showArchived ? '还没有已归档目标' : '从一个真正想实现的目标开始'}
                    </p>
                    {!showArchived && (
                      <>
                        <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-gray-400">
                          不需要先选课程，也不用先知道完整路线。先告诉 AI 你想达到什么。
                        </p>
                        <button
                          type="button"
                          onClick={() => setEditingGoal(null)}
                          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#242424] px-4 py-2.5 text-xs font-black text-[#cae393]"
                        >
                          <BrainCircuit size={13} /> 和 AI 制定目标
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          <div className="mt-4 rounded-2xl border border-dashed border-[#b0a8db]/50 bg-[#f7f5fc] px-4 py-3">
            <div className="flex items-start gap-2">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-[#6f63a8]" />
              <div>
                <p className="text-xs font-bold text-[#4f4675]">学习目标与课程已经分开</p>
                <p className="mt-1 text-[10px] leading-4 text-[#756f8d]">
                  课程继续在“计划/课程”里作为真实课表管理；这里只处理你主动想达成的学习目标。AI 生成的执行项仍然是普通 Task，因此会进入今天、计划、提醒与专注。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingGoal !== undefined && (
        <GoalDialog
          goal={editingGoal}
          onClose={() => setEditingGoal(undefined)}
          onSave={saveGoal}
        />
      )}

      {planningGoal && (
        <PlannerSheet
          open
          selectedDate={new Date()}
          onClose={() => {
            setPlanningGoal(null);
            setPlannerSeed('');
            void loadGoals();
          }}
          onApplied={handlePlannerApplied}
          initialPrompt={plannerSeed}
          scopeType="goal"
          scopeId={planningGoal.id}
          threadTitle={planningGoal.name}
          allowNewThread={false}
        />
      )}
    </>
  );
}
