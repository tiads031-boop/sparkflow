import type { FreeSlot } from '../../utils/freeSlots';

const time = (iso: string) => new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function FreeTimeCard({ slots, now }: { slots: readonly FreeSlot[]; now: Date }) {
  const upcoming = slots.find((slot) => new Date(slot.end) > now) ?? slots[0];
  return (
    <section className="rounded-[var(--sf-radius-md)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4">
      <p className="text-xs text-[var(--sf-text-tertiary)]">此刻，留一点空白</p>
      {upcoming ? (
        <div className="mt-1 flex items-end justify-between gap-3">
          <strong className="text-lg">{time(upcoming.start)}–{time(upcoming.end)}</strong>
          <span className="text-xs text-[var(--sf-text-secondary)]">{upcoming.durationMinutes} 分钟空闲</span>
        </div>
      ) : <p className="mt-1 text-sm font-semibold">可安排时间已排满</p>}
    </section>
  );
}
