const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

export default function WeekPlanView({ selectedDate }: { selectedDate: Date }) {
  const date = new Date(selectedDate.getTime());
  const monday = new Date(date);
  const offset = (date.getDay() + 6) % 7;
  monday.setDate(date.getDate() - offset);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });

  return (
    <section className="overflow-hidden rounded-[1.75rem] bg-[var(--sf-surface)] shadow-sm">
      <div className="grid grid-cols-[46px_repeat(7,minmax(42px,1fr))] border-b border-black/5 bg-[var(--sf-surface)] px-2 py-2">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="text-center">
            <p className="text-[9px] font-bold text-[var(--sf-text-tertiary)]">{'日一二三四五六'[day.getDay()]}</p>
            <p className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-full text-[11px] font-black ${
              day.toDateString() === date.toDateString() ? 'bg-[#242424] text-white' : 'text-[var(--sf-text-primary)]'
            }`}>{day.getDate()}</p>
          </div>
        ))}
      </div>
      <div className="max-h-[56svh] overflow-auto">
        {hours.map((hour) => (
          <div key={hour} className="grid min-h-20 grid-cols-[46px_repeat(7,minmax(42px,1fr))] border-b border-black/5 px-2">
            <div className="pt-2 text-[9px] font-semibold text-[var(--sf-text-tertiary)]">{hour}</div>
            {days.map((day) => <div key={`${hour}-${day.toISOString()}`} className="border-l border-black/[0.04]" />)}
          </div>
        ))}
      </div>
      <div className="border-t border-black/5 bg-[var(--sf-bg)] px-4 py-3 text-[10px] text-[var(--sf-text-tertiary)]">
        周视图 M1 仅建立高密度时间网格；M2 接入真实课程、固定日程与任务时间块。
      </div>
    </section>
  );
}
