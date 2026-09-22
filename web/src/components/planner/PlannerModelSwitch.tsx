import type { PlanningModel } from '../../api/planning';

export default function PlannerModelSwitch({ value, disabled, onChange }: {
  value: PlanningModel;
  disabled: boolean;
  onChange: (value: PlanningModel) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-[var(--sf-bg)] p-1" role="group" aria-label="选择文字模型">
      {([{ value: 'deepseek-v4-flash', label: 'Flash', detail: '快速响应' }, { value: 'deepseek-v4-pro', label: 'Pro', detail: '深度规划' }] as const).map((option) => <button key={option.value} type="button" disabled={disabled} aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`rounded-xl px-3 py-2 text-left transition disabled:opacity-40 ${value === option.value ? 'bg-[var(--sf-graphite)] text-white shadow-sm' : 'text-[var(--sf-text-secondary)]'}`}><strong className="block text-[11px]">{option.label}</strong><span className={`text-[8px] ${value === option.value ? 'text-white/45' : 'text-[var(--sf-text-tertiary)]'}`}>{option.detail}</span></button>)}
    </div>
  );
}
