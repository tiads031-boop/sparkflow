export default function MonthPlanView({ selectedDate }: { selectedDate: Date }) {
  const date = new Date(selectedDate.getTime());
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const cells = Array.from({ length: mondayOffset + daysInMonth }, (_, index) =>
    index < mondayOffset ? null : index - mondayOffset + 1,
  );
  const today = new Date();

  return (
    <section className="rounded-[1.75rem] bg-[var(--sf-surface)] p-4 shadow-sm">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sf-text-tertiary)]">Month</p>
          <h2 className="text-lg font-black text-[var(--sf-text-primary)]">{year} 年 {month + 1} 月</h2>
        </div>
        <span className="text-[10px] text-[var(--sf-text-tertiary)]">M2 接入真实安排</span>
      </div>
      <div className="grid grid-cols-7 gap-y-2 text-center text-[10px] font-bold text-[var(--sf-text-tertiary)]">
        {'一二三四五六日'.split('').map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          const active = day === date.getDate();
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          return (
            <div key={`${index}-${day ?? 'blank'}`} className="aspect-square rounded-xl p-1 text-center">
              {day && (
                <div className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                  active ? 'bg-[#242424] text-white' : isToday ? 'bg-[#cae393] text-[#242424]' : 'text-[var(--sf-text-primary)]'
                }`}>
                  {day}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-2xl bg-[var(--sf-bg)] px-4 py-4 text-xs leading-5 text-[var(--sf-text-tertiary)]">
        月视图壳层已就位。下一阶段会在日期格中投影 Course、CalendarEvent 和已排程 Task，并在点选日期后展开当天 Agenda。
      </div>
    </section>
  );
}
