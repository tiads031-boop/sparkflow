export type TimelineMode = 'month' | 'week' | 'timeline';

const views: { id: TimelineMode; label: string }[] = [
  { id: 'month', label: '月' },
  { id: 'week', label: '周' },
  { id: 'timeline', label: '时间轴' },
];

export default function ViewSwitcher({ value, onChange }: { value: TimelineMode; onChange: (mode: TimelineMode) => void }) {
  return (
    <div className="flex rounded-full bg-[var(--sf-surface)] p-1" role="group" aria-label="日历视图">
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          aria-pressed={value === view.id}
          onClick={() => onChange(view.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${value === view.id ? 'bg-[var(--sf-text-primary)] text-[var(--sf-surface)]' : 'text-[var(--sf-text-secondary)]'}`}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
