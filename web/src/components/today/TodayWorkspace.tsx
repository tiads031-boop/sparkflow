import { BarChart3, BrainCircuit, Clock3, Loader2 } from 'lucide-react';
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
  onStartFocus: () => void;
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
    <div className="min-h-full animate-page-enter pb-24">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-black tracking-[-0.04em] text-[var(--sf-text-primary)]">今天</h1>
          <p className="mt-0.5 text-[11px] text-[var(--sf-text-secondary)]">{date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="日程页面">
          <button type="button" onClick={onOpenPlan} className="rounded-full border border-[var(--sf-border)] bg-[var(--sf-surface)] px-3 py-2 text-[10px] font-extrabold text-[var(--sf-text-primary)]" aria-label="打开本周计划">本周计划</button>
        </div>
      </header>

      <div className="space-y-3">
        <TodayMetrics values={metrics} />
        {plannerPreview && previewItems.length > 0 && (
          <button type="button" onClick={onPlanner} className="flex w-full items-center justify-between rounded-[22px] border border-dashed border-[#8d82bd] bg-[var(--sf-purple-soft)] px-4 py-3 text-left">
            <span><strong className="block text-xs text-[#4f4675]">AI 安排预览 · {previewItems.length} 项</strong><span className="mt-0.5 block text-[10px] text-[#716792]">预览尚未写入日程</span></span>
            <BrainCircuit size={17} className="text-[#665a91]" />
          </button>
        )}
        <TodayTimeRail date={date} plannedItems={plannedItems} previewItems={previewItems} actualEntries={actualEntries} activeFocus={activeFocus} />
        <div className="flex justify-end gap-2" role="group" aria-label="时间页面">
          <button type="button" onClick={onOpenActual} className="inline-flex items-center gap-1 rounded-full bg-[var(--sf-surface)] px-2.5 py-1.5 text-[10px] font-bold text-[var(--sf-text-secondary)]"><Clock3 size={12} />实际时间</button>
          <button type="button" onClick={onOpenAnalytics} className="inline-flex items-center gap-1 rounded-full bg-[var(--sf-surface)] px-2.5 py-1.5 text-[10px] font-bold text-[var(--sf-text-secondary)]"><BarChart3 size={12} />时间分析</button>
        </div>
        {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">部分今日数据加载失败：{error}</div>}
        {loading && <div className="flex items-center justify-center gap-2 py-3 text-xs text-[var(--sf-text-tertiary)]"><Loader2 size={14} className="animate-spin" />同步今日数据…</div>}
        <TodayAgenda items={plannedItems} onItemClick={openItem} />
      </div>
    </div>
  );
}
