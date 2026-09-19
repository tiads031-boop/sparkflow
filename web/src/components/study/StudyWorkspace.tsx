import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
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
  const total = goal.tasks.length;
  const done = goal.tasks.filter(isDone).length;
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
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
          setSaving(true);
          setError(null);
          try {
            await onSave({
              name: name.trim(),
              description: description.trim() || null,
              color,
              taskIds: goal?.tasks.map((task) => task.id),
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
  onPlan,
  onEdit,
  onArchive,
}: {
  goal: StudyFolder;
  onPlan: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const progress = goalProgress(goal);
  return (
    <article
      className="rounded-[1.7rem] border border-black/[0.05] p-4 shadow-sm"
      style={{ backgroundColor: `${goal.color}20` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[#242424]"
          style={{ backgroundColor: goal.color }}
        >
          <Target size={19} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-[#242424]">{goal.name}</h3>
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-gray-500">
                {goal.description || '还没有补充背景，AI 会在规划时继续了解。'}
              </p>
            </div>
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
            <div className="flex items-center justify-between text-[9px] font-bold text-gray-400">
              <span>{progress.done}/{progress.total || 0} 个执行任务已完成</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/80">
              <div
                className="h-full rounded-full bg-[#242424] transition-[width]"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-bold">
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-gray-500">
              {goal.tasks.length} 个任务
            </span>
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-gray-500">
              {goal.planningThread
                ? `AI 上下文 r${goal.planningThread.revision} · ${goal.planningThread.conversationCount} 轮`
                : '尚未建立 AI 规划'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={onPlan}
          className="flex items-center justify-center gap-2 rounded-full bg-[#242424] py-2.5 text-xs font-black text-[#cae393]"
        >
          <Sparkles size={13} />
          {goal.planningThread ? '继续和 AI 规划' : '开始 AI 规划'}
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/80 text-gray-500"
          aria-label={goal.status === 'archived' ? '恢复目标' : '归档目标'}
        >
          {goal.status === 'archived' ? <RotateCcw size={14} /> : <Archive size={14} />}
        </button>
      </div>
    </article>
  );
}

export default function StudyWorkspace({
  onStartFocus,
}: {
  onStartFocus: () => void;
}) {
  const loadTasks = useAppStore((state) => state.loadTasks);
  const todayCount = useAppStore((state) => state.pomodoro.todayCount);
  const totalFocusMinutes = useAppStore((state) => state.pomodoro.totalFocusMinutes);

  const [goals, setGoals] = useState<StudyFolder[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<StudyFolder | null | undefined>(undefined);
  const [planningGoal, setPlanningGoal] = useState<StudyFolder | null>(null);
  const [plannerSeed, setPlannerSeed] = useState('');

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

  const today = new Date();
  const todayTasks = useMemo(() => {
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
  }, [activeGoals, today.toDateString()]);

  const openGoalPlanning = (goal: StudyFolder, seed = '') => {
    setPlannerSeed(seed);
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
    });
    setEditingGoal(undefined);
    await loadGoals();

    const background = input.description?.trim()
      ? `我目前补充的背景是：${input.description.trim()}。`
      : '';
    openGoalPlanning(
      created,
      `我想把“${created.name}”作为一个长期学习目标。${background}请先尽可能了解我的成功标准、当前水平、可用资源、每周时间预算、偏好和取舍；如果计划依赖考试时间、报名规则、官方大纲、目标要求或资源版本，请先联网核实。不要急着一次性给完计划，先从高影响问题开始了解我。`,
    );
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
    <div className="animate-page-enter pb-24">
      <header className="mb-5 rounded-[2rem] bg-[#242424] p-5 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#cae393]">
              AI Learning Goals
            </p>
            <h1 className="mt-1 text-2xl font-black">学习，不再从“选一门课”开始。</h1>
            <p className="mt-2 max-w-md text-xs leading-5 text-white/60">
              先说清你想达到什么。AI 会持续了解你的现状和约束，必要时联网核实，再把目标拆成真正能执行的任务与时间安排。
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
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-[1.6rem] bg-white p-4 shadow-sm">
          <Target size={17} className="text-[#8b7fbc]" />
          <p className="mt-3 text-2xl font-black text-[#242424]">{activeGoals.length}</p>
          <p className="text-[10px] text-gray-400">进行中的学习目标</p>
        </div>
        <div className="rounded-[1.6rem] bg-[#e5e2f3] p-4 shadow-sm">
          <Clock3 size={17} className="text-[#5a4f86]" />
          <p className="mt-3 text-2xl font-black text-[#242424]">
            {totalFocusMinutes}
            <span className="ml-1 text-xs text-gray-500">分钟</span>
          </p>
          <p className="text-[10px] text-gray-500">今日专注 · {todayCount} 次</p>
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
        ) : (
          <div className="space-y-3">
            {visibleGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
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
    </div>
  );
}
