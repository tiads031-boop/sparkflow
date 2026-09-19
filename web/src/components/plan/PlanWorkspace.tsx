import { useState } from 'react';
import { CalendarDays, Columns3, ListTodo } from 'lucide-react';
import type { PlanView, Task } from '../../types';
import BoardView from '../BoardView';
import TasksView from '../TasksView';
import AgendaPlanView from './AgendaPlanView';
import MonthPlanView from './MonthPlanView';
import PlanHeader from './PlanHeader';
import TimetablePlanView from './TimetablePlanView';
import WeekPlanView from './WeekPlanView';
import { readLastPlanView, writeLastPlanView } from './planPreferences';
import { useAppStore } from '../../store/appStore';

type PlanSection = 'calendar' | 'tasks';
type TaskView = 'list' | 'board';

interface PlanWorkspaceProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onPlanner: () => void;
  onQuickAdd: () => void;
  initialSection?: PlanSection;
  initialTaskView?: TaskView;
  initialPlanView?: PlanView;
}

export default function PlanWorkspace({
  tasks,
  onTaskClick,
  onPlanner,
  onQuickAdd,
  initialSection = 'calendar',
  initialTaskView = 'list',
  initialPlanView,
}: PlanWorkspaceProps) {
  const selectedDate = useAppStore((state) => state.selectedDate);
  const [section, setSection] = useState<PlanSection>(initialSection);
  const [taskView, setTaskView] = useState<TaskView>(initialTaskView);
  const [view, setView] = useState<PlanView>(() => initialPlanView ?? readLastPlanView());
  const [viewMenuOpen, setViewMenuOpen] = useState(false);

  const selectView = (next: PlanView) => {
    setView(next);
    writeLastPlanView(next);
    setViewMenuOpen(false);
    setSection('calendar');
  };

  return (
    <div className="min-h-full animate-page-enter pb-24">
      <PlanHeader
        view={view}
        viewMenuOpen={viewMenuOpen}
        onToggleViewMenu={() => setViewMenuOpen((open) => !open)}
        onSelectView={selectView}
        onQuickAdd={onQuickAdd}
        onPlanner={onPlanner}
      />

      <div className="px-3">
        <nav aria-label="计划工作区" className="mb-3 grid grid-cols-2 rounded-2xl bg-[var(--sf-surface)] p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setSection('calendar')}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${
              section === 'calendar' ? 'bg-[#242424] text-white' : 'text-[var(--sf-text-tertiary)]'
            }`}
          >
            <CalendarDays size={14} /> 日历
          </button>
          <button
            type="button"
            onClick={() => setSection('tasks')}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${
              section === 'tasks' ? 'bg-[#242424] text-white' : 'text-[var(--sf-text-tertiary)]'
            }`}
          >
            <ListTodo size={14} /> 待办
          </button>
        </nav>

        {section === 'calendar' && (
          <>
            {view === 'month' && <MonthPlanView selectedDate={selectedDate} />}
            {view === 'week' && <WeekPlanView selectedDate={selectedDate} />}
            {view === 'agenda' && <AgendaPlanView onTaskClick={onTaskClick} />}
            {view === 'timetable' && <TimetablePlanView selectedDate={selectedDate} />}
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
                  onClick={() => setTaskView('list')}
                  className={`grid h-8 w-8 place-items-center rounded-lg ${
                    taskView === 'list' ? 'bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-sm' : 'text-[var(--sf-text-tertiary)]'
                  }`}
                  aria-label="列表视图"
                >
                  <ListTodo size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setTaskView('board')}
                  className={`grid h-8 w-8 place-items-center rounded-lg ${
                    taskView === 'board' ? 'bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-sm' : 'text-[var(--sf-text-tertiary)]'
                  }`}
                  aria-label="看板视图"
                >
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
