import { useMemo, useState } from 'react';
import { CalendarDays, Grid2X2, ListTodo, Loader2 } from 'lucide-react';
import { apiRequest } from '../../api/client';
import type { PlannerPreview, PlanView, Task } from '../../types';
import TasksView from '../TasksView';
import QuadrantView from '../QuadrantView';
import AgendaPlanView from './AgendaPlanView';
import ActualTimelineView from './ActualTimelineView';
import MonthPlanView from './MonthPlanView';
import PlanHeader from './PlanHeader';
import WeekPlanView from './WeekPlanView';
import { readLastPlanView, writeLastPlanView } from './planPreferences';
import { buildPlannerPreviewItems, getMonday, getSemesterWeekNumber, localDateKey, type PlanItem } from './planProjection';
import { usePlanItems } from './usePlanItems';
import { useAppStore } from '../../store/appStore';
import { readUserPreferences } from '../../utils/userPreferences';

type PlanSection = 'calendar' | 'tasks';
type TaskView = 'list' | 'quadrant';

interface PlanWorkspaceProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onCourseClick?: (courseId: string) => void;
  onCreateAt?: (date: Date) => void;
  onAdjustTask?: (task: Task, start: Date, end: Date) => void;
  onPlanner: () => void;
  plannerPreview?: PlannerPreview | null;
  initialSection?: PlanSection;
  sectionOnly?: PlanSection;
  initialTaskView?: TaskView;
  initialPlanView?: PlanView;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

const PLAN_TASK_VIEW_KEY = 'sparkflow.planTaskView';

function readTaskView(): TaskView {
  if (typeof window === 'undefined') return 'list';
  return window.localStorage.getItem(PLAN_TASK_VIEW_KEY) === 'quadrant' ? 'quadrant' : 'list';
}

function writeTaskView(view: TaskView) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PLAN_TASK_VIEW_KEY, view);
}

export default function PlanWorkspace({
  tasks,
  onTaskClick,
  onCourseClick,
  onCreateAt,
  onAdjustTask,
  onPlanner,
  plannerPreview,
  initialSection = 'calendar',
  sectionOnly,
  initialTaskView,
  initialPlanView,
}: PlanWorkspaceProps) {
  const selectedDate = useAppStore((state) => state.selectedDate);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const semesters = useAppStore((state) => state.semesters);
  const activeSemesterId = useAppStore((state) => state.activeSemesterId);
  const [section, setSection] = useState<PlanSection>(sectionOnly ?? initialSection);
  const quadrantEnabled = readUserPreferences().quadrantEnabled;
  const [taskView, setTaskView] = useState<TaskView>(() => {
    const requested = initialTaskView ?? readTaskView();
    return requested === 'quadrant' && !quadrantEnabled ? 'list' : requested;
  });
  const [view, setView] = useState<PlanView>(() => initialPlanView ?? readLastPlanView());

  const activeSemester = semesters.find((semester) => semester.id === activeSemesterId) ?? null;
  const planData = usePlanItems(selectedDate, view);
  const previewItems = useMemo(
    () => buildPlannerPreviewItems(plannerPreview, tasks),
    [plannerPreview, tasks],
  );
  const visibleItems = view === 'week' || view === 'agenda' || view === 'timeline'
    ? [...planData.items, ...previewItems]
    : planData.items;
  const semesterWeek = getSemesterWeekNumber(selectedDate, activeSemester);
  const currentWeek = localDateKey(getMonday(selectedDate)) === localDateKey(getMonday(new Date()));

  const headerCopy = useMemo(() => {
    if (view === 'month') {
      return {
        title: selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }),
        subtitle: activeSemester?.name || '月度安排',
      };
    }

    if (view === 'agenda' || view === 'timeline') {
      return {
        title: selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }),
        subtitle: `${selectedDate.toLocaleDateString('zh-CN', { weekday: 'long' })}${semesterWeek ? ` · 第 ${semesterWeek} 周` : ''}`,
      };
    }

    const monday = getMonday(selectedDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      title: semesterWeek
        ? `第 ${semesterWeek} 周${currentWeek ? '' : '（非本周）'}`
        : (currentWeek ? '本周计划' : '周计划'),
      subtitle: `${semesterWeek ? (semesterWeek % 2 === 1 ? '单周 · ' : '双周 · ') : ''}${formatShortDate(monday)} – ${formatShortDate(sunday)}`,
    };
  }, [activeSemester?.name, currentWeek, selectedDate, semesterWeek, view]);

  const selectView = (next: PlanView) => {
    setView(next);
    writeLastPlanView(next);
    if (!sectionOnly) setSection('calendar');
  };

  const shiftDate = (direction: -1 | 1) => {
    const next = new Date(selectedDate);
    if (view === 'month') {
      const day = next.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
    } else {
      next.setDate(next.getDate() + direction * (view === 'agenda' || view === 'timeline' ? 1 : 7));
    }
    setSelectedDate(next);
  };

  const handlePlanItemClick = (item: PlanItem) => {
    if (item.taskId) {
      const task = tasks.find((candidate) => candidate.id === item.taskId);
      if (task) onTaskClick(task);
      return;
    }
    if (item.courseId) onCourseClick?.(item.courseId);
  };

  const handleAdjustTask = (item: PlanItem, start: Date, end: Date) => {
    if (!item.taskId || !['task', 'study-task'].includes(item.kind) || item.preview || !onAdjustTask) return;
    const task = tasks.find((candidate) => candidate.id === item.taskId);
    if (!task) return;
    if (task.scheduleLocked && !window.confirm(`“${task.title}”已设为固定时间，仍要调整吗？`)) return;
    onAdjustTask(task, start, end);
  };

  const handleFocusDelete = async (item: PlanItem) => {
    if (!item.focusSessionId) return;
    if (!window.confirm('删除这条专注记录？删除后将从日程和专注统计中移除。')) return;
    await apiRequest(`/pomodoro/${item.focusSessionId}`, { method: 'DELETE' });
    window.dispatchEvent(new Event('sparkflow:calendar-changed'));
  };

  return (
    <div className="min-h-full animate-page-enter pb-24">
      {section !== 'tasks' && <PlanHeader
        view={view}
        title={headerCopy.title}
        subtitle={headerCopy.subtitle}
        onSelectView={selectView}
        onPrevious={() => shiftDate(-1)}
        onNext={() => shiftDate(1)}
        onToday={() => setSelectedDate(new Date())}
        onPlanner={onPlanner}
      />}

      <div className="px-3">
        {!sectionOnly && <nav aria-label="计划工作区" className="mb-3 grid grid-cols-2 rounded-2xl bg-[var(--sf-surface)] p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setSection('calendar')}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${section === 'calendar' ? 'bg-[#242424] text-white' : 'text-[var(--sf-text-tertiary)]'}`}
          >
            <CalendarDays size={14} /> 日历
          </button>
          <button
            type="button"
            onClick={() => setSection('tasks')}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${section === 'tasks' ? 'bg-[#242424] text-white' : 'text-[var(--sf-text-tertiary)]'}`}
          >
            <ListTodo size={14} /> 待办
          </button>
        </nav>}

        {section === 'calendar' && previewItems.length > 0 && (
          <button
            type="button"
            onClick={onPlanner}
            className="mb-3 flex w-full items-center justify-between rounded-2xl border border-dashed border-[#8b7fbc] bg-[#e5e2f3]/60 px-4 py-3 text-left"
          >
            <span>
              <span className="block text-xs font-black text-[#4f4675]">AI 安排预览 · {previewItems.length} 项</span>
              <span className="mt-0.5 block text-[10px] text-[#6d638e]">虚线时间块尚未写入日程，点击查看并确认。</span>
            </span>
            <span className="text-[10px] font-black text-[#4f4675]">查看 →</span>
          </button>
        )}

        {section === 'calendar' && (
          <>
            {planData.error && (
              <div className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                日历事件加载失败：{planData.error}。课程和本地任务仍会继续显示。
              </div>
            )}
            {planData.loading && (
              <div className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-[var(--sf-surface)] px-4 py-2 text-[10px] font-bold text-[var(--sf-text-tertiary)] shadow-sm">
                <Loader2 size={12} className="animate-spin" /> 正在同步当前视图…
              </div>
            )}

            {view === 'month' && (
              <MonthPlanView
                selectedDate={selectedDate}
                items={planData.items}
                onSelectDate={setSelectedDate}
                onItemClick={handlePlanItemClick}
              />
            )}
            {view === 'week' && (
              <WeekPlanView
                selectedDate={selectedDate}
                items={visibleItems}
                onSelectDate={setSelectedDate}
                onItemClick={handlePlanItemClick}
                onCreateAt={onCreateAt}
                onAdjustTask={handleAdjustTask}
              />
            )}
            {view === 'agenda' && (
              <AgendaPlanView
                selectedDate={selectedDate}
                items={visibleItems}
                onItemClick={handlePlanItemClick}
                onFocusDelete={handleFocusDelete}
              />
            )}
            {view === 'timeline' && (
              <ActualTimelineView
                selectedDate={selectedDate}
                plannedItems={visibleItems}
                tasks={tasks}
                onTaskClick={(taskId) => {
                  const task = tasks.find((candidate) => candidate.id === taskId);
                  if (task) onTaskClick(task);
                }}
              />
            )}
          </>
        )}

        {section === 'tasks' && (
          <section>
            <div className="mb-3 flex items-center justify-between rounded-2xl bg-[var(--sf-surface)] px-3 py-2 shadow-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sf-text-tertiary)]">Tasks</p>
                <h2 className="text-sm font-black text-[var(--sf-text-primary)]">待办工作区</h2>
              </div>
              <div className="flex rounded-xl bg-[var(--sf-bg)] p-1">
                <button
                  type="button"
                  onClick={() => { setTaskView('list'); writeTaskView('list'); }}
                  className={`flex h-8 items-center gap-1 rounded-lg px-2 ${taskView === 'list' ? 'bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-sm' : 'text-[var(--sf-text-tertiary)]'}`}
                  aria-label="列表视图"
                >
                  <ListTodo size={14} /><span className="text-[10px] font-bold">列表</span>
                </button>
                {quadrantEnabled && (
                  <button
                    type="button"
                    onClick={() => { setTaskView('quadrant'); writeTaskView('quadrant'); }}
                    className={`flex h-8 items-center gap-1 rounded-lg px-2 ${taskView === 'quadrant' ? 'bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-sm' : 'text-[var(--sf-text-tertiary)]'}`}
                    aria-label="四象限视图"
                  >
                    <Grid2X2 size={14} /><span className="text-[10px] font-bold">四象限</span>
                  </button>
                )}
              </div>
            </div>
            {taskView === 'list'
              ? <TasksView tasks={tasks} onTaskClick={onTaskClick} />
              : <QuadrantView tasks={tasks} onTaskClick={onTaskClick} />}
          </section>
        )}
      </div>
    </div>
  );
}
