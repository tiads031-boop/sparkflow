import { useMemo, useState } from 'react';
import { CalendarDays, Columns3, ListTodo, Loader2 } from 'lucide-react';
import type { PlanView, Task } from '../../types';
import BoardView from '../BoardView';
import TasksView from '../TasksView';
import AgendaPlanView from './AgendaPlanView';
import MonthPlanView from './MonthPlanView';
import PlanHeader from './PlanHeader';
import TimetablePlanView from './TimetablePlanView';
import WeekPlanView from './WeekPlanView';
import { readLastPlanView, writeLastPlanView } from './planPreferences';
import { getMonday, getSemesterWeekNumber, localDateKey, type PlanItem } from './planProjection';
import { usePlanItems } from './usePlanItems';
import { useAppStore } from '../../store/appStore';

type PlanSection = 'calendar' | 'tasks';
type TaskView = 'list' | 'board';

interface PlanWorkspaceProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onCourseClick?: (courseId: string) => void;
  onPlanner: () => void;
  onQuickAdd: () => void;
  initialSection?: PlanSection;
  initialTaskView?: TaskView;
  initialPlanView?: PlanView;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

export default function PlanWorkspace({
  tasks,
  onTaskClick,
  onCourseClick,
  onPlanner,
  onQuickAdd,
  initialSection = 'calendar',
  initialTaskView = 'list',
  initialPlanView,
}: PlanWorkspaceProps) {
  const selectedDate = useAppStore((state) => state.selectedDate);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const courses = useAppStore((state) => state.courses);
  const semesters = useAppStore((state) => state.semesters);
  const activeSemesterId = useAppStore((state) => state.activeSemesterId);
  const [section, setSection] = useState<PlanSection>(initialSection);
  const [taskView, setTaskView] = useState<TaskView>(initialTaskView);
  const [view, setView] = useState<PlanView>(() => initialPlanView ?? readLastPlanView());
  const [viewMenuOpen, setViewMenuOpen] = useState(false);

  const activeSemester = semesters.find((semester) => semester.id === activeSemesterId) ?? null;
  const planData = usePlanItems(selectedDate, view);
  const semesterWeek = getSemesterWeekNumber(selectedDate, activeSemester);
  const currentWeek = localDateKey(getMonday(selectedDate)) === localDateKey(getMonday(new Date()));

  const headerCopy = useMemo(() => {
    if (view === 'month') {
      return {
        title: selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }),
        subtitle: activeSemester?.name || '月度安排',
      };
    }

    if (view === 'agenda') {
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
    setViewMenuOpen(false);
    setSection('calendar');
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
      next.setDate(next.getDate() + direction * (view === 'agenda' ? 1 : 7));
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

  return (
    <div className="min-h-full animate-page-enter pb-24">
      <PlanHeader
        view={view}
        title={headerCopy.title}
        subtitle={headerCopy.subtitle}
        viewMenuOpen={viewMenuOpen}
        onToggleViewMenu={() => setViewMenuOpen((open) => !open)}
        onSelectView={selectView}
        onPrevious={() => shiftDate(-1)}
        onNext={() => shiftDate(1)}
        onToday={() => setSelectedDate(new Date())}
        onQuickAdd={onQuickAdd}
        onPlanner={onPlanner}
      />

      <div className="px-3">
        <nav aria-label="计划工作区" className="mb-3 grid grid-cols-2 rounded-2xl bg-[var(--sf-surface)] p-1 shadow-sm">
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
        </nav>

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
                items={planData.items}
                onSelectDate={setSelectedDate}
                onItemClick={handlePlanItemClick}
              />
            )}
            {view === 'agenda' && (
              <AgendaPlanView
                selectedDate={selectedDate}
                items={planData.items}
                onItemClick={handlePlanItemClick}
              />
            )}
            {view === 'timetable' && (
              <TimetablePlanView
                selectedDate={selectedDate}
                courses={courses}
                semester={activeSemester}
                onCourseClick={onCourseClick}
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
                <button type="button" onClick={() => setTaskView('list')} className={`grid h-8 w-8 place-items-center rounded-lg ${taskView === 'list' ? 'bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-sm' : 'text-[var(--sf-text-tertiary)]'}`} aria-label="列表视图">
                  <ListTodo size={15} />
                </button>
                <button type="button" onClick={() => setTaskView('board')} className={`grid h-8 w-8 place-items-center rounded-lg ${taskView === 'board' ? 'bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-sm' : 'text-[var(--sf-text-tertiary)]'}`} aria-label="看板视图">
                  <Columns3 size={15} />
                </button>
              </div>
            </div>
            {taskView === 'list'
              ? <TasksView tasks={tasks} onTaskClick={onTaskClick} />
              : <BoardView tasks={tasks} onTaskClick={onTaskClick} />}
          </section>
        )}
      </div>
    </div>
  );
}
