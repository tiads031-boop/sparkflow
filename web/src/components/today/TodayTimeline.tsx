import { BookOpen, CalendarClock, CheckCircle2, Clock3, FileText, ListTodo, Play } from 'lucide-react';
import type { ActualTimelineEntry } from '../../api/actualTimeline';
import type { InspirationRecord } from '../../api/inspirations';
import type { PlanItem } from '../plan/planProjection';
import { recordText } from '../records/recordPresentation';
import { EmptyState } from '../ui/foundation';

interface ActiveFocus {
  id: string;
  title: string;
  start: string;
  end: string;
}

type TimelineItem =
  | { kind: 'plan'; at: string; item: PlanItem }
  | { kind: 'record'; at: string; record: InspirationRecord }
  | { kind: 'focus'; at: string; entry: ActualTimelineEntry }
  | { kind: 'running'; at: string; focus: ActiveFocus };

function time(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function TodayTimeline({ items, records, actualEntries, activeFocus, onItemClick, onRecordClick, onFocusClick, onRunningFocusClick }: {
  items: PlanItem[];
  records: InspirationRecord[];
  actualEntries: ActualTimelineEntry[];
  activeFocus?: ActiveFocus | null;
  onItemClick: (item: PlanItem) => void;
  onRecordClick: (record: InspirationRecord) => void;
  onFocusClick: () => void;
  onRunningFocusClick: () => void;
}) {
  const timeline: TimelineItem[] = [
    ...items.map((item): TimelineItem => ({ kind: 'plan', at: item.start, item })),
    ...records.map((record): TimelineItem => ({ kind: 'record', at: record.createdAt, record })),
    ...actualEntries.map((entry): TimelineItem => ({ kind: 'focus', at: entry.start, entry })),
    ...(activeFocus ? [{ kind: 'running' as const, at: activeFocus.start, focus: activeFocus }] : []),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <section>
      <div className="mb-3 flex items-end justify-between px-1">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--sf-text-tertiary)]">Today · Timeline</p>
          <h2 className="text-base font-black text-[var(--sf-text-primary)]">今日记录</h2>
        </div>
        <span className="text-[10px] text-[var(--sf-text-tertiary)]">{timeline.length} 项</span>
      </div>
      {timeline.length === 0 ? <EmptyState title="今天还没有记录" description="日程、随手记录与专注时间会在这里按时间出现。" /> : (
        <div className="relative space-y-3 before:absolute before:bottom-5 before:left-[48px] before:top-5 before:w-px before:bg-[var(--sf-divider)]">
          {timeline.map((event) => {
            const plan = event.kind === 'plan' ? event.item : null;
            const record = event.kind === 'record' ? event.record : null;
            const focus = event.kind === 'focus' ? event.entry : null;
            const running = event.kind === 'running' ? event.focus : null;
            const Icon = plan?.kind === 'course' ? BookOpen : plan?.kind === 'calendar' ? CalendarClock : plan?.completed ? CheckCircle2 : plan ? ListTodo : record ? FileText : running ? Play : Clock3;
            const color = plan?.color || (record ? 'var(--sf-purple)' : 'var(--sf-green-strong)');
            const title = plan?.title || (record ? recordText(record) : focus?.title || running?.title || '');
            const imageCount = record?.attachments?.filter((attachment) => attachment.kind === 'image').length || 0;
            const detail = plan
              ? `${time(plan.start)}–${time(plan.end)}${plan.location ? ` · ${plan.location}` : ''}`
              : record
                ? [imageCount ? `${imageCount} 张图片` : '', ...(record.tags || []).map((tag) => `#${tag}`)].filter(Boolean).join(' · ')
                : focus
                  ? `${time(focus.start)}–${time(focus.end)} · 有效 ${Math.round(focus.effectiveDurationSeconds / 60)} 分钟${focus.notes ? ` · ${focus.notes}` : ''}`
                  : '专注进行中';
            return (
              <div key={`${event.kind}-${plan?.id || record?.id || focus?.id || running?.id}`} className="relative grid grid-cols-[36px_14px_minmax(0,1fr)] items-start gap-2">
                <time dateTime={event.at} className="pt-4 text-[10px] font-bold tabular-nums text-[var(--sf-text-tertiary)]">{time(event.at)}</time>
                <span className="relative z-10 mt-[19px] h-2.5 w-2.5 rounded-full border-2 border-[var(--sf-surface)]" style={{ backgroundColor: color }} />
                <button type="button" onClick={() => plan ? onItemClick(plan) : record ? onRecordClick(record) : running ? onRunningFocusClick() : onFocusClick()} className="min-w-0 rounded-[20px] border border-[var(--sf-border)] bg-[var(--sf-surface)] px-3.5 py-3 text-left shadow-[0_8px_24px_rgba(31,37,34,0.035)]">
                  <span className="flex items-center gap-2 text-[10px] font-bold text-[var(--sf-text-tertiary)]"><Icon size={13} style={{ color }} />{plan ? '日程' : record ? '记录' : running ? '正在专注' : focus?.source === 'manual' ? '实际投入' : '专注完成'}</span>
                  <strong className="mt-1 block line-clamp-2 break-words text-[13px] font-bold leading-5 text-[var(--sf-text-primary)]">{title}</strong>
                  {detail && <span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-[var(--sf-text-tertiary)]">{detail}</span>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
