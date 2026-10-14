import { BrainCircuit, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { InspirationRecord } from '../../api/inspirations';
import type { PlannerPreview, Task } from '../../types';
import type { PlanItem } from '../plan/planProjection';
import TodayTimeline from './TodayTimeline';
import TodayMetrics from './TodayMetrics';
import TodayTimeRail from './TodayTimeRail';
import { useTodayWorkspaceData } from './useTodayWorkspaceData';
import PlanHeader from '../plan/PlanHeader';
import type { ScheduleView } from '../plan/ScheduleViewPicker';

interface TodayWorkspaceProps {
  tasks: Task[];
  plannerPreview?: PlannerPreview | null;
  onTaskClick: (task: Task) => void;
  onCourseClick?: (courseId: string) => void;
  onPlanner: () => void;
  onScheduleViewChange: (view: ScheduleView) => void;
  onOpenActual: () => void;
  onOpenAnalytics: () => void;
  onRecordClick: (record: InspirationRecord) => void;
  onOpenFocus: () => void;
}

export default function TodayWorkspace({
  tasks,
  plannerPreview,
  onTaskClick,
  onCourseClick,
  onPlanner,
  onScheduleViewChange,
  onOpenActual,
  onOpenAnalytics,
  onRecordClick,
  onOpenFocus,
}: TodayWorkspaceProps) {
  const [date] = useState(() => new Date());
  const activeSessionId = useAppStore((state) => state.pomodoro.activeSessionId);
  const activeTaskId = useAppStore((state) => state.pomodoro.activeTaskId);
  const activeStartedAt = useAppStore((state) => state.pomodoro.startedAt);
  const activeElapsedSeconds = useAppStore((state) => state.pomodoro.effectiveDurationSeconds);
  const { plannedItems, previewItems, actualEntries, records, metrics, loading, error } = useTodayWorkspaceData(date, tasks, plannerPreview);
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
      <PlanHeader view="today" title={date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })} onSelectView={onScheduleViewChange} onPlanner={onPlanner} />

      <div className="space-y-4 px-4">
        <TodayMetrics values={metrics} />
        {plannerPreview && previewItems.length > 0 && (
          <button type="button" onClick={onPlanner} className="flex w-full items-center justify-between rounded-[22px] border border-dashed border-[#8d82bd] bg-[var(--sf-purple-soft)] px-4 py-3 text-left">
            <span><strong className="block text-xs text-[#4f4675]">AI 安排预览 · {previewItems.length} 项</strong><span className="mt-0.5 block text-[10px] text-[#716792]">预览尚未写入日程</span></span>
            <BrainCircuit size={17} className="text-[#665a91]" />
          </button>
        )}
        <TodayTimeRail date={date} plannedItems={plannedItems} previewItems={previewItems} actualEntries={actualEntries} activeFocus={activeFocus} onOpenActual={onOpenActual} onOpenAnalytics={onOpenAnalytics} />
        {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">部分今日数据加载失败：{error}</div>}
        {loading && <div className="flex items-center justify-center gap-2 py-3 text-xs text-[var(--sf-text-tertiary)]"><Loader2 size={14} className="animate-spin" />同步今日数据…</div>}
        <TodayTimeline items={plannedItems} records={records} actualEntries={actualEntries} activeFocus={activeFocus} onItemClick={openItem} onRecordClick={onRecordClick} onFocusClick={onOpenActual} onRunningFocusClick={onOpenFocus} />
      </div>
    </div>
  );
}
