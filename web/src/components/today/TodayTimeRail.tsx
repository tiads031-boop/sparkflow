import type { ActualTimelineEntry } from '../../api/actualTimeline';
import type { PlanItem } from '../plan/planProjection';
import { useTimeTrackingPreferences } from '../profile/useTimeTrackingPreferences';

interface ActiveFocusRailItem { id: string; title: string; start: string; end: string }
interface TodayTimeRailProps {
  date: Date;
  plannedItems: PlanItem[];
  previewItems: PlanItem[];
  actualEntries: ActualTimelineEntry[];
  activeFocus?: ActiveFocusRailItem | null;
  onStartFocus: () => void;
}

const START_MINUTE = 8 * 60;
const END_MINUTE = 22 * 60;
function position(value: string | Date) {
  const time = value instanceof Date ? value : new Date(value);
  return Math.min(100, Math.max(0, ((time.getHours() * 60 + time.getMinutes() - START_MINUTE) / (END_MINUTE - START_MINUTE)) * 100));
}
function rangeStyle(start: string, end: string) {
  const left = position(start);
  return { left: `${left}%`, width: `${Math.max(1.4, position(end) - left)}%` };
}
function withinRail(start: string, end: string) {
  return position(end) > 0 && position(start) < 100 && new Date(end) > new Date(start);
}

export default function TodayTimeRail({ date, plannedItems, previewItems, actualEntries, activeFocus, onStartFocus }: TodayTimeRailProps) {
  const quickStartEnabled = useTimeTrackingPreferences()?.quickStartEnabled === true;
  const isToday = date.toDateString() === new Date().toDateString();
  const nowLeft = position(new Date());
  return (
    <section className="rounded-[24px] border border-[#e8ece7] bg-[linear-gradient(145deg,#fbfcf8,#fff)] px-[15px] pb-3.5 pt-3.5 shadow-[0_10px_30px_rgba(22,28,25,.08)]" aria-label="今日时间轨道">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-black text-[var(--sf-text-primary)]">今日时间轨道</h2>
        {quickStartEnabled && isToday && actualEntries.length === 0 && !activeFocus
          ? <button type="button" onClick={onStartFocus} className="rounded-full bg-[var(--sf-graphite)] px-2.5 py-1.5 text-[9px] font-bold text-[var(--sf-green)]">开始专注</button>
          : <span className="text-[9px] font-extrabold text-[var(--sf-text-secondary)]">08:00 — 22:00</span>}
      </div>
      <div className="relative mx-0.5 h-[70px]" role="img" aria-label={`08:00 至 22:00，计划 ${plannedItems.length} 项，实际 ${actualEntries.length} 项`}>
        <div className="absolute inset-x-0 top-7 h-[3px] rounded-full bg-[#e7eae7]" />
        {[8, 10, 12, 14, 16, 18, 20].map((hour) => (
          <div key={hour} className="absolute top-[21px] h-[17px] w-px bg-[#d3d8d4]" style={{ left: `${((hour * 60 - START_MINUTE) / (END_MINUTE - START_MINUTE)) * 100}%` }}>
            <span className="absolute left-[-10px] top-5 w-5 text-center text-[8px] text-[var(--sf-text-tertiary)]">{String(hour).padStart(2, '0')}</span>
          </div>
        ))}
        {plannedItems.filter((item) => withinRail(item.start, item.end)).map((item) => (
          <span key={item.id} title={item.title} className="absolute top-4 z-[1] h-[26px] overflow-hidden whitespace-nowrap rounded-xl px-1.5 py-1.5 text-[8px] font-black text-[#414844] shadow-[inset_0_0_0_1px_rgba(65,75,65,.04)]" style={{ ...rangeStyle(item.start, item.end), backgroundColor: item.kind === 'course' || item.kind === 'calendar' ? '#dfedf8' : item.color || '#e1f1c1' }}>{item.title}</span>
        ))}
        {previewItems.filter((item) => withinRail(item.start, item.end)).map((item) => (
          <span key={item.id} title={item.title} className="absolute top-4 z-[2] h-[26px] overflow-hidden whitespace-nowrap rounded-xl border border-dashed border-[#8b7fbc] bg-[#f0ecfa] px-1.5 py-1 text-[8px] font-black text-[#655d84]" style={rangeStyle(item.start, item.end)}>{item.title}</span>
        ))}
        {actualEntries.filter((entry) => withinRail(entry.start, entry.end)).map((entry) => (
          <span key={entry.id} title={entry.title} className="absolute top-4 z-[3] h-[26px] overflow-hidden whitespace-nowrap rounded-xl bg-[#e1f1c1] px-1.5 py-1.5 text-[8px] font-black text-[#414844]" style={rangeStyle(entry.start, entry.end)}>{entry.title}</span>
        ))}
        {activeFocus && withinRail(activeFocus.start, activeFocus.end) && <span title={activeFocus.title} className="absolute top-4 z-[4] h-[26px] overflow-hidden whitespace-nowrap rounded-xl bg-[var(--sf-purple-soft)] px-1.5 py-1.5 text-[8px] font-black text-[#5a5474]" style={rangeStyle(activeFocus.start, activeFocus.end)}>{activeFocus.title}</span>}
        {isToday && nowLeft > 0 && nowLeft < 100 && <span className="absolute bottom-2 top-[7px] z-[5] w-[2px] rounded-full bg-[#677957] before:absolute before:left-[-4px] before:top-[18px] before:h-2.5 before:w-2.5 before:rounded-full before:bg-[#a7c87b] before:shadow-[0_0_0_3px_rgba(167,200,123,.18)]" style={{ left: `${nowLeft}%` }} />}
      </div>
      <div className="flex flex-wrap gap-1.5 text-[8px] font-extrabold text-[#717773]">
        <span className="rounded-full bg-[#ecf6db] px-2 py-1 text-[#53663e]">已发生 / 正在发生</span>
        <span className="rounded-full bg-[#f1f3f1] px-2 py-1">计划</span>
        <span className="rounded-full bg-[#f0ecfa] px-2 py-1 text-[#655d84]">深度专注</span>
      </div>
    </section>
  );
}
