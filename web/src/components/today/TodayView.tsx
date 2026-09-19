import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, CheckSquare2, Lock, MapPin, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { Task } from '../../types';
import { localDateKey, type PlanItem } from '../plan/planProjection';
import { usePlanItems } from '../plan/usePlanItems';

function sourceMeta(item: PlanItem) {
  if (item.kind === 'course') return { label: '课程', Icon: BookOpen };
  if (item.kind === 'study-task') return { label: '学习', Icon: Sparkles };
  if (item.kind === 'task') return { label: item.scheduleSource === 'ai' ? 'AI 安排' : '任务', Icon: CheckSquare2 };
  return { label: '日程', Icon: CalendarDays };
}

export default function TodayView({
  onTaskClick,
  onCourseClick,
}: {
  onTaskClick: (task: Task) => void;
  onCourseClick?: (courseId: string) => void;
}) {
  const tasks = useAppStore((state) => state.tasks);
  const [now, setNow] = useState(() => new Date());
  const todayKey = localDateKey(now);
  const today = useMemo(() => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    return date;
  }, [todayKey]);
  const planData = usePlanItems(today, 'agenda');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectItem = (item: PlanItem) => {
    if (item.taskId) {
      const task = tasks.find((candidate) => candidate.id === item.taskId);
      if (task) onTaskClick(task);
      return;
    }
    if (item.courseId) onCourseClick?.(item.courseId);
  };

  return (
    <div className="animate-page-enter pb-5">
      <header className="mb-5">
        <h1 className="text-2xl font-black text-[var(--sf-text-primary)]">今天</h1>
        <p className="mt-1 text-xs font-medium text-[var(--sf-text-tertiary)]">
          {today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </header>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black text-[var(--sf-text-primary)]">今日安排</h2>
          <span className="text-[10px] font-semibold text-[var(--sf-text-tertiary)]">
            {planData.items.length} 项
          </span>
        </div>

        {planData.error && (
          <div className="mb-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            外部日历暂时加载失败，本地任务和课程仍会继续显示。
          </div>
        )}

        {planData.loading && planData.items.length === 0 ? (
          <div className="rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] px-4 py-8 text-center text-sm text-[var(--sf-text-tertiary)]">
            正在加载今日安排…
          </div>
        ) : planData.items.length === 0 ? (
          <div className="rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] px-4 py-8 text-center text-sm text-[var(--sf-text-secondary)]">
            今天还没有安排
          </div>
        ) : (
          <div className="relative space-y-2 before:absolute before:bottom-4 before:left-[50px] before:top-4 before:w-px before:bg-black/[0.06]">
            {planData.items.map((item) => {
              const start = new Date(item.start);
              const end = new Date(item.end);
              const active = start <= now && end > now;
              const { label, Icon } = sourceMeta(item);
              const clickable = Boolean(item.taskId || item.courseId);

              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => selectItem(item)}
                  disabled={!clickable}
                  className={`relative flex w-full items-stretch gap-3 rounded-[var(--sf-radius-md)] px-2 py-3 text-left transition-transform ${active ? 'bg-[#eef6dc]' : 'bg-[var(--sf-surface)]'} ${clickable ? 'active:scale-[0.99]' : 'cursor-default'} ${item.completed ? 'opacity-50' : ''}`}
                >
                  <span className="relative z-10 w-9 shrink-0 pt-1 text-right text-[10px] font-black text-[var(--sf-text-secondary)]">
                    {start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                  <span
                    className="relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-[var(--sf-bg)] shadow-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <strong className="truncate text-sm text-[var(--sf-text-primary)]">{item.title}</strong>
                      {item.locked && <Lock size={11} className="shrink-0 text-[var(--sf-text-tertiary)]" />}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--sf-text-tertiary)]">
                      <span className="inline-flex items-center gap-1"><Icon size={10} />{label}</span>
                      <span>
                        {start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        {'–'}
                        {end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                      {item.location && <span className="inline-flex max-w-full items-center gap-1 truncate"><MapPin size={10} />{item.location}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
