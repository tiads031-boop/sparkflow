import { useState, useMemo } from 'react';
import type { Task, ChartView, PomodoroState } from '../store/appStore';
import { useAppStore } from '../store/appStore';
import { V4 } from '../v4config';

function PomodoroStats({ todayCount, totalFocusMinutes }: { todayCount: number; totalFocusMinutes: number }) {
  return (
    <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-4">
      <h3 className="text-sm font-bold text-[#242424] mb-3">专注统计</h3>
      <div className="flex gap-3">
        <div className="flex-1 bg-[#b0a8db]/15 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-[#242424]">{todayCount}</div>
          <div className="text-[10px] text-gray-500 mt-1">今日番茄</div>
        </div>
        <div className="flex-1 bg-[#cae393]/20 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-[#242424]">{totalFocusMinutes}</div>
          <div className="text-[10px] text-gray-500 mt-1">专注分钟</div>
        </div>
      </div>
    </div>
  );
}

interface BarData {
  h1: number; // green segment height %
  h2: number; // purple segment height %
  h3: number; // dark segment height %
  label: string;
  fullLabel: string;
  taskCount: number;
}

/** 计算指定 view 下的柱状图数据 */
function computeBars(tasks: Task[], view: ChartView): BarData[] {
  const active = tasks.filter((t) => t.status !== 'Cancelled');
  const total = active.length;

  if (view === 'day') {
    const cfg = V4.chart.day;
    const bars: BarData[] = [];
    for (let h = V4.timelineStartHour; h < V4.timelineEndHour; h += cfg.groupStep) {
      const hourTasks = active.filter((t) => {
        if (!t.startTime) return false;
        const startH = parseInt(t.startTime.split(':')[0], 10);
        return startH >= h && startH < h + cfg.groupStep;
      });
      const ratio = cfg.ratioMin + hourTasks.length * cfg.ratioPerTask;
      const base = total > 0 ? cfg.baseHeightBase + total * cfg.totalScale : cfg.baseHeightEmpty;
      bars.push({
        h1: Math.min(Math.round(base * ratio * cfg.segmentRatios[0]) + cfg.segmentMinHeights[0], cfg.segmentMaxHeights[0]),
        h2: Math.min(Math.round(base * ratio * cfg.segmentRatios[1]) + cfg.segmentMinHeights[1], cfg.segmentMaxHeights[1]),
        h3: Math.min(Math.round(base * ratio * cfg.segmentRatios[2]) + cfg.segmentMinHeights[2], cfg.segmentMaxHeights[2]),
        label: `${h}`,
        fullLabel: `${h}:00~${h + cfg.groupStep}:00`,
        taskCount: hourTasks.length,
      });
    }
    return bars;
  }

  if (view === 'week') {
    const cfg = V4.chart.week;
    const days = ['一', '二', '三', '四', '五', '六', '日'];
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; // 1=Mon
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const baseH = total > 0 ? Math.min(cfg.baseHeightMax, cfg.baseHeightBase + total * cfg.totalScale) : cfg.baseHeightEmpty;
    return days.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dayTasks = active.filter((t) => {
        if (!t.dueDate) return false;
        const dd = new Date(t.dueDate);
        return dd.toDateString() === d.toDateString();
      });
      const scale = cfg.dayWeights[i];
      return {
        // h1 涉及 done 任务数量占比，保留原有业务逻辑
        h1: Math.min(Math.round(baseH * scale * (active.filter((t) => t.status === 'Done').length / Math.max(total, 1))) + 10, 85),
        h2: Math.min(Math.round(baseH * scale * cfg.segmentRatios[0]) + cfg.segmentMinHeights[0], cfg.segmentMaxHeights[0]),
        h3: Math.min(Math.round(baseH * scale * cfg.segmentRatios[1]) + cfg.segmentMinHeights[1], cfg.segmentMaxHeights[1]),
        label: days[i],
        fullLabel: `周${days[i]}`,
        taskCount: dayTasks.length,
      };
    });
  }

  // month: group by groupStep-day intervals
  const cfg = V4.chart.month;
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const bars: BarData[] = [];
  for (let d = 1; d <= daysInMonth; d += cfg.groupStep) {
    const dayTasks = active.filter((t) => {
      if (!t.dueDate) return false;
      const dd = new Date(t.dueDate);
      return dd.getMonth() === today.getMonth() && dd.getDate() >= d && dd.getDate() < d + cfg.groupStep;
    });
    const ratio = cfg.ratioMin + dayTasks.length * cfg.ratioPerTask;
    const base = total > 0 ? cfg.baseHeightBase + total * cfg.totalScale : cfg.baseHeightEmpty;
    bars.push({
      h1: Math.min(Math.round(base * ratio * cfg.segmentRatios[0]) + cfg.segmentMinHeights[0], cfg.segmentMaxHeights[0]),
      h2: Math.min(Math.round(base * ratio * cfg.segmentRatios[1]) + cfg.segmentMinHeights[1], cfg.segmentMaxHeights[1]),
      h3: Math.min(Math.round(base * ratio * cfg.segmentRatios[2]) + cfg.segmentMinHeights[2], cfg.segmentMaxHeights[2]),
      label: `${d}`,
      fullLabel: `${d}日`,
      taskCount: dayTasks.length,
    });
  }
  return bars;
}

/** 获取对应柱状图时段的真实任务列表 */
function getBarTasks(tasks: Task[], view: ChartView, barIndex: number): Task[] {
  const active = tasks.filter((t) => t.status !== 'Cancelled');

  if (view === 'day') {
    const cfg = V4.chart.day;
    const h = V4.timelineStartHour + barIndex * cfg.groupStep;
    return active.filter((t) => {
      if (!t.startTime) return false;
      const startH = parseInt(t.startTime.split(':')[0], 10);
      return startH >= h && startH < h + cfg.groupStep;
    });
  }

  if (view === 'week') {
    const today = new Date();
    const dayOfWeek = today.getDay() || 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    const d = new Date(monday);
    d.setDate(monday.getDate() + barIndex);
    return active.filter((t) => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate).toDateString() === d.toDateString();
    });
  }

  // month
  const cfg = V4.chart.month;
  const today = new Date();
  const startDay = 1 + barIndex * cfg.groupStep;
  return active.filter((t) => {
    if (!t.dueDate) return false;
    const dd = new Date(t.dueDate);
    return dd.getMonth() === today.getMonth() && dd.getDate() >= startDay && dd.getDate() < startDay + cfg.groupStep;
  });
}

/** Drill-down bottom sheet */
function DrillSheet({
  label,
  tasks,
  onClose,
}: {
  label: string;
  tasks: Task[];
  onClose: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-50"
      style={{ pointerEvents: 'none' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        style={{ pointerEvents: 'auto' }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-[2rem] p-5 bg-[#f4f4f6] overflow-y-auto animate-slide-up-sheet"
        style={{ maxHeight: '55%', pointerEvents: 'auto' }}
      >
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
        <h3 className="text-sm font-bold text-[#242424] mb-3">
          {label} · {tasks.length} 项
        </h3>
        <div className="space-y-2 pb-4">
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">该时段无任务</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-100"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{
                    background:
                      task.colorType === 'dark'
                        ? '#242424'
                        : task.colorType === 'green'
                          ? '#cae393'
                          : '#b0a8db',
                  }}
                />
                <span className="flex-1 text-sm text-[#242424] truncate">
                  {task.title}
                </span>
                <span className="text-[10px] text-gray-400">{task.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardView({ tasks, pomodoro }: { tasks: Task[]; pomodoro: PomodoroState }) {
  const chartView = useAppStore((s) => s.chartView);
  const setChartView = useAppStore((s) => s.setChartView);
  const [drillLabel, setDrillLabel] = useState<string | null>(null);
  const [drillIndex, setDrillIndex] = useState<number>(0);

  const inProgress = tasks.filter((t) => t.status === 'In progress').length;
  const inReview = tasks.filter((t) => t.status === 'In review').length;
  const todo = tasks.filter((t) => t.status === 'To do').length;
  const total = tasks.filter((t) => t.status !== 'Cancelled').length;

  const bars = useMemo(() => computeBars(tasks, chartView), [tasks, chartView]);

  const viewLabel = (v: ChartView) => (v === 'day' ? '日' : v === 'week' ? '周' : '月');

  return (
    <div className="animate-page-enter pb-24">
      <h1 className="text-xl font-bold mb-5 text-[#242424]">仪表盘概览</h1>

      {/* Stat pills */}
      <div className="space-y-2.5 mb-6">
        <div className="flex gap-2.5">
          <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-[#b0a8db] text-[#242424] flex-1 shadow-sm">
            <span className="text-sm font-medium">进行中</span>
            <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-bold">{inProgress}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-white text-[#242424] border border-gray-100 flex-1 shadow-sm">
            <span className="text-sm font-medium">审核中</span>
            <span className="w-6 h-6 rounded-full bg-[#f4f4f6] flex items-center justify-center text-xs font-bold">{inReview}</span>
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-[#242424] text-white flex-1 shadow-sm">
            <span className="text-sm font-medium">全部任务</span>
            <span className="w-6 h-6 rounded-full bg-white text-[#242424] flex items-center justify-center text-xs font-bold">{total}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-[#cae393] text-[#242424] flex-1 shadow-sm">
            <span className="text-sm font-medium">待处理</span>
            <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-bold">{todo}</span>
          </div>
        </div>
      </div>

      {/* Chart card */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-4">
        {/* View toggle pills */}
        <div className="flex bg-[#f3f4f6] rounded-full p-1 mb-5">
          {(['day', 'week', 'month'] as ChartView[]).map((v) => (
            <button
              key={v}
              onClick={() => setChartView(v)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-full transition-all ${
                chartView === v
                  ? v === 'week'
                    ? 'bg-[#cae393] text-[#242424]'
                    : 'bg-white text-[#242424] shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              {viewLabel(v)}
            </button>
          ))}
        </div>

        {/* Bar chart / Empty state */}
        {total === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center border-b border-gray-100">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c4c4c4" strokeWidth="1.5">
                <rect x="3" y="12" width="4" height="9" rx="1" />
                <rect x="10" y="7" width="4" height="14" rx="1" />
                <rect x="17" y="3" width="4" height="18" rx="1" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">暂无任务数据</p>
            <p className="text-[10px] text-gray-300 mt-0.5">添加任务后柱状图自动同步</p>
          </div>
        ) : (
          <>
            <div className="h-44 flex items-end justify-between gap-1.5 px-1 pb-4 relative border-b border-gray-100">
              {bars.map((bar, i) => (
                <div
                  key={i}
                  className="chart-bar-group flex-1 flex flex-col justify-end gap-0.5 h-full cursor-pointer"
                  onClick={() => {
                    setDrillIndex(i);
                    setDrillLabel(bar.fullLabel);
                  }}
                  style={{ transition: 'opacity 0.2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  <div className="w-full bg-[#cae393] rounded-t-sm opacity-80" style={{ height: `${bar.h1}%` }} />
                  <div className="w-full bg-[#b0a8db] rounded-sm opacity-80" style={{ height: `${bar.h2}%` }} />
                  <div className="w-full bg-[#242424] rounded-b-sm opacity-90" style={{ height: `${bar.h3}%` }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 px-1">
              {bars.map((bar, i) => (
                <span key={i} className="text-[10px] text-gray-400 text-center" style={{ width: `${100 / bars.length}%` }}>
                  {bar.label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pomodoro stats */}
      <PomodoroStats todayCount={pomodoro.todayCount} totalFocusMinutes={pomodoro.totalFocusMinutes} />

      {/* Today's tasks */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[#242424] mb-3">今日待办</h3>
        {tasks
          .filter((t) => t.status !== 'Done' && t.status !== 'Cancelled')
          .slice(0, 4)
          .map((task) => (
            <div key={task.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  task.colorType === 'dark'
                    ? 'bg-[#242424]'
                    : task.colorType === 'green'
                      ? 'bg-[#cae393]'
                      : 'bg-[#b0a8db]'
                }`}
              />
              <span className="flex-1 text-sm text-[#242424] truncate">{task.title}</span>
              <span className="text-[10px] text-gray-400">{task.time || task.startTime || ''}</span>
            </div>
          ))}
        {tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled').length === 0 && (
          <p className="text-center text-sm text-gray-400 py-6">暂无待办，去创建任务吧</p>
        )}
      </div>

      {/* Drill-down sheet */}
      {drillLabel !== null && (
        <DrillSheet
          label={drillLabel}
          tasks={getBarTasks(tasks, chartView, drillIndex)}
          onClose={() => setDrillLabel(null)}
        />
      )}
    </div>
  );
}
