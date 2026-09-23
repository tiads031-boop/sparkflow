import type { ReactNode } from 'react';
import type { ActualTimelineEntry } from '../../api/actualTimeline';
import type { PlanItem } from '../plan/planProjection';
import { useTimeTrackingPreferences } from '../profile/useTimeTrackingPreferences';

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
  onStartFocus: () => void;
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
      <div className="relative h-7 overflow-hidden rounded-lg bg-[var(--sf-bg)]">{children}</div>
    </div>
  );
}

export default function TodayTimeRail({
  date,
  plannedItems,
  previewItems,
  actualEntries,
  activeFocus,
  onStartFocus,
}: TodayTimeRailProps) {
  const quickStartEnabled = useTimeTrackingPreferences()?.quickStartEnabled === true;
  const isToday = date.toDateString() === new Date().toDateString();
  const nowLeft = dayPosition(new Date(), date);

  return (
    <section className="rounded-[24px] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 shadow-[0_10px_30px_rgba(22,28,25,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-black text-[var(--sf-text-primary)]">今日时间轨道</h2>
        </div>
        {quickStartEnabled && isToday && actualEntries.length === 0 && !activeFocus ? <button type="button" onClick={onStartFocus} className="rounded-full bg-[var(--sf-graphite)] px-3 py-2 text-[10px] font-bold text-white">空白开始 Focus</button> : <span className="text-[9px] font-bold text-[var(--sf-text-tertiary)]">00:00 — 24:00</span>}
      </div>
      <div className="space-y-2">
        <RailRow label="计划">
          {plannedItems.map((item) => (
            <span key={item.id} title={item.title} className="absolute inset-y-1 rounded-md" style={{ ...rangeStyle(item.start, item.end, date), backgroundColor: item.kind === 'course' || item.kind === 'calendar' ? 'var(--sf-blue)' : item.color }} />
          ))}
        </RailRow>
        <RailRow label="实际">
          {actualEntries.map((entry) => (
            <span key={entry.id} title={entry.title} className="absolute inset-y-1 rounded-md bg-[var(--sf-green-strong)]" style={rangeStyle(entry.start, entry.end, date)} />
          ))}
        </RailRow>
        {(activeFocus || previewItems.length > 0) && (
          <RailRow label="进行中">
            {previewItems.map((item) => (
              <span key={item.id} title={item.title} className="absolute inset-y-1 rounded-md border border-dashed border-[#7467a9] bg-[var(--sf-purple-soft)]" style={rangeStyle(item.start, item.end, date)} />
            ))}
            {activeFocus && <span title={activeFocus.title} className="absolute inset-y-1 rounded-md bg-[var(--sf-purple)]" style={rangeStyle(activeFocus.start, activeFocus.end, date)} />}
          </RailRow>
        )}
      </div>
      <div className="relative ml-[54px] mt-2 h-4 text-[8px] text-[var(--sf-text-tertiary)]">
        {[0, 6, 12, 18, 24].map((hour) => <span key={hour} className="absolute -translate-x-1/2" style={{ left: `${(hour / 24) * 100}%` }}>{String(hour).padStart(2, '0')}</span>)}
        {isToday && <span className="absolute bottom-4 top-[-100px] w-px bg-[#c77979]" style={{ left: `${nowLeft}%` }} aria-label="当前时间" />}
      </div>
    </section>
  );
}
