import type { ReactNode } from 'react';
import { ArrowLeft, ChevronRight, X } from 'lucide-react';

export function PageHeader({ title, eyebrow, subtitle, onBack, action }: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex min-w-0 items-start gap-3">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="返回" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sf-surface)] shadow-sm">
          <ArrowLeft size={17} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--sf-text-tertiary)]">{eyebrow}</p>}
        <h1 className="truncate text-xl font-black text-[var(--sf-text-primary)]">{title}</h1>
        {subtitle && <p className="mt-1 text-xs leading-5 text-[var(--sf-text-tertiary)]">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[1.65rem] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 shadow-sm ${className}`}>{children}</section>;
}

export function SegmentControl<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="grid gap-1 rounded-2xl bg-[var(--sf-bg)] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)} className={`min-w-0 rounded-xl px-2 py-2 text-[11px] font-bold transition ${option.value === value ? 'bg-[var(--sf-text-primary)] text-[var(--sf-surface)] shadow-sm' : 'text-[var(--sf-text-tertiary)]'}`}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function InfoRow({ icon, label, value, onClick, children }: {
  icon?: ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const content = (
    <>
      {icon && <span className="text-[var(--sf-text-tertiary)]">{icon}</span>}
      <span className="min-w-0 flex-1 text-xs font-bold text-[var(--sf-text-secondary)]">{label}</span>
      {children || <span className="max-w-[58%] truncate text-xs text-[var(--sf-text-primary)]">{value || '未设置'}</span>}
      {onClick && <ChevronRight size={14} className="text-[var(--sf-text-tertiary)]" />}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 border-b border-[var(--sf-divider)] px-1 py-3 text-left last:border-0">{content}</button>
  ) : (
    <div className="flex w-full items-center gap-2 border-b border-[var(--sf-divider)] px-1 py-3 last:border-0">{content}</div>
  );
}

export function TagChip({ name, color = '#cae393', selected = true, onClick, onRemove, muted = false }: {
  name: string;
  color?: string;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  muted?: boolean;
}) {
  const style = selected && !muted ? { backgroundColor: `${color}2b`, borderColor: `${color}80` } : undefined;
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${selected && !muted ? 'text-[var(--sf-text-primary)]' : 'border-[var(--sf-border)] bg-[var(--sf-bg)] text-[var(--sf-text-tertiary)]'}`} style={style}>
      <button type="button" onClick={onClick} disabled={!onClick} className="truncate">#{name}</button>
      {onRemove && <button type="button" onClick={onRemove} aria-label={`移除标签 ${name}`}><X size={11} /></button>}
    </span>
  );
}

export function BottomActionBar({ children }: { children: ReactNode }) {
  return <footer className="sticky bottom-0 z-20 -mx-1 mt-5 border-t border-[var(--sf-divider)] bg-[var(--sf-surface)]/95 px-1 pb-[calc(env(safe-area-inset-bottom,0px)+4px)] pt-3 backdrop-blur">{children}</footer>;
}

export function FolderChip({ name }: { name: string }) {
  return <span className="inline-flex rounded-full bg-[#f4f2fb] px-2.5 py-1 text-[11px] font-bold text-[#665a91]">文件夹 · {name}</span>;
}

export function StatusChip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' }) {
  const tones = { neutral: 'bg-[var(--sf-bg)] text-[var(--sf-text-secondary)]', success: 'bg-[#eef6dc] text-[#526339]', warning: 'bg-[#fff4dc] text-[#8a611f]' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-[1.5rem] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4"><span className="text-[10px] font-bold text-[var(--sf-text-tertiary)]">{label}</span><strong className="mt-1 block text-xl font-black text-[var(--sf-text-primary)]">{value}</strong>{detail && <span className="mt-1 block text-[10px] text-[var(--sf-text-tertiary)]">{detail}</span>}</div>;
}

export function DangerAction({ children, onClick, disabled = false }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="rounded-full bg-red-50 px-4 py-3 text-xs font-bold text-red-700 disabled:opacity-40">{children}</button>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <div className="rounded-[1.5rem] border border-dashed border-[var(--sf-border)] px-5 py-9 text-center"><strong className="text-sm text-[var(--sf-text-primary)]">{title}</strong>{description && <p className="mt-1 text-xs leading-5 text-[var(--sf-text-tertiary)]">{description}</p>}</div>;
}
