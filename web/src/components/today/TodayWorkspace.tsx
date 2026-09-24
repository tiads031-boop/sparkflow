import { BarChart3, BrainCircuit, CalendarDays, Clock3, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { PlannerPreview, Task } from '../../types';
import type { PlanItem } from '../plan/planProjection';
import TodayAgenda from './TodayAgenda';
import TodayMetrics from './TodayMetrics';
import TodayTimeRail from './TodayTimeRail';
import { useTodayWorkspaceData } from './useTodayWorkspaceData';

interface TodayWorkspaceProps {
  tasks: Task[];
  plannerPreview?: PlannerPreview | null;
  onTaskClick: (task: Task) => void;
  onCourseClick?: (courseId: string) => void;
  onPlanner: () => void;
  onOpenPlan: () => void;
  onOpenActual: () => void;
  onOpenAnalytics: () => void;
}

export default function TodayWorkspace({
  tasks,
  plannerPreview,
  onTaskClick,
  onCourseClick,
  onPlanner,
  onOpenPlan,
  onOpenActual,
  onOpenAnalytics,
}: TodayWorkspaceProps) {
  const [date] = useState(() => new Date());
  const activeSessionId = useAppStore((state) => state.pomodoro.activeSessionId);
  const activeTaskId = useAppStore((state) => state.pomodoro.activeTaskId);
  const activeStartedAt = useAppStore((state) => state.pomodoro.startedAt);
  const activeElapsedSeconds = useAppStore((state) => state.pomodoro.effectiveDurationSeconds);
  const { plannedItems, previewItems, actualEntries, metrics, loading, error } = useTodayWorkspaceData(date, tasks, plannerPreview);
  const activeFocus = useMemo(() => {
    if (!activeSessionId || !activeStartedAt) return null;
    return {
      id: activeSessionId,
      title: tasks.find((task) => task.id === activeTaskId)?.title || '自由专注',
      start: activeStartedAt,
      end: new Date(new Date(activeStartedAt).getTime() + activeElapsedSeconds * 1000).toISOString(),
    };
  }, [activeElapsedSeconds, activeSessionId, activeStartedAt, activeTaskId, tasks]);

  const openItem = (item: PlanItem) => {
    if (item.taskId) {
      const task = tasks.find((candidate) => candidate.id === item.taskId);
      if (task) onTaskClick(task);
      return;
    }
    if (item.courseId) onCourseClick?.(item.courseId);
  };

  return (
    <div className="min-h-full animate-page-enter px-4 pb-24">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sf-text-tertiary)]">{date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
          <h1 className="mt-1 text-[28px] font-black tracking-[-0.04em] text-[var(--sf-text-primary)]">今天</h1>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-[var(--sf-surface)] p-1 shadow-sm" role="group" aria-label="日程页面">
          <button type="button" aria-pressed="true" className="rounded-full bg-[var(--sf-graphite)] px-3 py-2 text-[10px] font-black text-[var(--sf-bg)]">今天</button>
          <button type="button" onClick={onOpenPlan} className="grid h-8 w-8 place-items-center rounded-full text-[var(--sf-text-secondary)]" aria-label="打开计划"><CalendarDays size={15} /></button>
          <button type="button" onClick={onOpenActual} className="grid h-8 w-8 place-items-center rounded-full text-[var(--sf-text-secondary)]" aria-label="打开实际时间线"><Clock3 size={15} /></button>
          <button type="button" onClick={onOpenAnalytics} className="grid h-8 w-8 place-items-center rounded-full text-[var(--sf-text-secondary)]" aria-label="打开时间分析"><BarChart3 size={15} /></button>
        </div>
      </header>

      <div className="space-y-4">
        <TodayMetrics values={metrics} />
        {plannerPreview && previewItems.length > 0 && (
          <button type="button" onClick={onPlanner} className="flex w-full items-center justify-between rounded-[22px] border border-dashed border-[#8d82bd] bg-[var(--sf-purple-soft)] px-4 py-3 text-left">
            <span><strong className="block text-xs text-[#4f4675]">AI 安排预览 · {previewItems.length} 项</strong><span className="mt-0.5 block text-[10px] text-[#716792]">预览尚未写入日程</span></span>
            <BrainCircuit size={17} className="text-[#665a91]" />
          </button>
        )}
        <TodayTimeRail date={date} plannedItems={plannedItems} previewItems={previewItems} actualEntries={actualEntries} activeFocus={activeFocus} />
        {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">部分今日数据加载失败：{error}</div>}
        {loading && <div className="flex items-center justify-center gap-2 py-3 text-xs text-[var(--sf-text-tertiary)]"><Loader2 size={14} className="animate-spin" />同步今日数据…</div>}
        <TodayAgenda items={plannedItems} onItemClick={openItem} />
      </div>
    </div>
  );
}
