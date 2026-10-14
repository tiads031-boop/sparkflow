import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ActualTimelineEntry } from '../../api/actualTimeline';
import type { PlanItem } from '../plan/planProjection';

interface ActiveFocusRailItem {
  id: string;
  title: string;
  start: string;
  end: string;
}

interface TodayTimeRailProps {
  date: Date;
  plannedItems: PlanItem[];
  previewItems: PlanItem[];
  actualEntries: ActualTimelineEntry[];
  activeFocus?: ActiveFocusRailItem | null;
  onOpenActual: () => void;
  onOpenAnalytics: () => void;
}

function dayPosition(value: string | Date, date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Math.min(100, Math.max(0, ((time - start.getTime()) / 86_400_000) * 100));
}

function rangeStyle(start: string, end: string, date: Date) {
  const left = dayPosition(start, date);
  const right = dayPosition(end, date);
  return { left: `${left}%`, width: `${Math.max(1.4, right - left)}%` };
}

function RailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[46px_1fr] items-center gap-2">
      <span className="text-[9px] font-bold text-[var(--sf-text-tertiary)]">{label}</span>
      <div className="relative h-5 overflow-hidden rounded-full bg-black/[0.035]">{children}</div>
    </div>
  );
}

export default function TodayTimeRail({
  date,
  plannedItems,
  previewItems,
  actualEntries,
  activeFocus,
  onOpenActual,
  onOpenAnalytics,
}: TodayTimeRailProps) {
  const isToday = date.toDateString() === new Date().toDateString();
  const nowLeft = dayPosition(new Date(), date);

  return (
    <section className="rounded-[26px] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 shadow-[0_14px_36px_rgba(31,37,34,0.055)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-black text-[var(--sf-text-primary)]">今日时间轨道</h2>
        <button type="button" onClick={onOpenAnalytics} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-1 text-xs font-bold text-[var(--sf-text-secondary)]">时间分析<ChevronRight size={14} /></button>
      </div>
      <div className="space-y-2">
        <RailRow label="计划">
          {plannedItems.map((item) => (
            <span key={item.id} title={item.title} className="absolute inset-y-1 rounded-full" style={{ ...rangeStyle(item.start, item.end, date), backgroundColor: item.kind === 'course' || item.kind === 'calendar' ? 'var(--sf-blue)' : item.color }} />
          ))}
        </RailRow>
        <RailRow label="实际">
          {actualEntries.map((entry) => (
            <span key={entry.id} title={entry.title} className="absolute inset-y-1 rounded-full bg-[var(--sf-green-strong)]" style={rangeStyle(entry.start, entry.end, date)} />
          ))}
        </RailRow>
        {(activeFocus || previewItems.length > 0) && (
          <RailRow label="进行中">
            {previewItems.map((item) => (
              <span key={item.id} title={item.title} className="absolute inset-y-1 rounded-full border border-dashed border-[#7467a9] bg-[var(--sf-purple-soft)]" style={rangeStyle(item.start, item.end, date)} />
            ))}
            {activeFocus && <span title={activeFocus.title} className="absolute inset-y-1 rounded-full bg-[var(--sf-purple)]" style={rangeStyle(activeFocus.start, activeFocus.end, date)} />}
          </RailRow>
        )}
      </div>
      <div className="relative ml-[54px] mt-2 h-4 text-[8px] text-[var(--sf-text-tertiary)]">
        {[0, 6, 12, 18, 24].map((hour) => <span key={hour} className="absolute -translate-x-1/2" style={{ left: `${(hour / 24) * 100}%` }}>{String(hour).padStart(2, '0')}</span>)}
        {isToday && <span className="absolute bottom-4 top-[-78px] w-px bg-[#c77979]" style={{ left: `${nowLeft}%` }} aria-label="当前时间" />}
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={onOpenActual} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-1 text-xs font-bold text-[var(--sf-text-secondary)]">查看实际记录<ChevronRight size={14} /></button>
      </div>
    </section>
  );
}
