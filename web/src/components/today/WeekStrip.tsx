interface WeekStripProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
}

export default function WeekStrip({ selectedDate, onSelect }: WeekStripProps) {
  const monday = new Date(selectedDate);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
  return (
    <div className="grid grid-cols-7 gap-1" aria-label="选择日期">
      {days.map((date) => {
        const active = date.toDateString() === selectedDate.toDateString();
        return (
          <button
            type="button"
            key={date.toISOString()}
            onClick={() => onSelect(date)}
            className={`rounded-[var(--sf-radius-sm)] py-2 text-center transition-colors ${active ? 'bg-[var(--sf-text-primary)] text-[var(--sf-surface)]' : 'text-[var(--sf-text-secondary)] hover:bg-[var(--sf-surface)]'}`}
          >
            <span className="block text-[10px]">{['一', '二', '三', '四', '五', '六', '日'][(date.getDay() || 7) - 1]}</span>
            <span className="mt-1 block text-sm font-bold">{date.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}
