const periods = [
  ['1', '08:00', '08:50'],
  ['2', '09:00', '09:50'],
  ['3', '10:10', '11:00'],
  ['4', '11:10', '12:00'],
  ['5', '13:30', '14:20'],
  ['6', '14:30', '15:20'],
  ['7', '15:40', '16:30'],
  ['8', '16:40', '17:30'],
  ['9', '18:30', '19:20'],
  ['10', '19:30', '20:20'],
];

export default function TimetablePlanView({ selectedDate }: { selectedDate: Date }) {
  const date = new Date(selectedDate.getTime());
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });

  return (
    <section className="overflow-hidden rounded-[1.75rem] bg-[var(--sf-surface)] shadow-sm">
      <div className="grid grid-cols-[52px_repeat(7,minmax(40px,1fr))] border-b border-black/5 px-2 py-3">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="text-center">
            <p className="text-[9px] text-[var(--sf-text-tertiary)]">{'日一二三四五六'[day.getDay()]}</p>
            <p className="text-xs font-black text-[var(--sf-text-primary)]">{day.getDate()}</p>
          </div>
        ))}
      </div>
      <div className="max-h-[58svh] overflow-auto">
        {periods.map(([period, start, end]) => (
          <div key={period} className="grid min-h-[72px] grid-cols-[52px_repeat(7,minmax(40px,1fr))] border-b border-black/5 px-2">
            <div className="flex flex-col justify-center">
              <strong className="text-lg leading-none text-[var(--sf-text-primary)]">{period}</strong>
              <span className="mt-1 text-[8px] leading-3 text-[var(--sf-text-tertiary)]">{start}<br />{end}</span>
            </div>
            {days.map((day) => <div key={`${period}-${day.toISOString()}`} className="border-l border-black/[0.04]" />)}
          </div>
        ))}
      </div>
      <div className="border-t border-black/5 bg-[var(--sf-bg)] px-4 py-3 text-[10px] text-[var(--sf-text-tertiary)]">
        时间表 M1 已按节次建立结构；单双周与 Course 卡片在 M2 按真实课程数据接入。
      </div>
    </section>
  );
}
