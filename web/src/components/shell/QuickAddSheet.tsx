import { createPortal } from 'react-dom';
import { BrainCircuit, CalendarPlus, CheckSquare, Focus, Lightbulb } from 'lucide-react';
import { useModalLifecycle } from '../ui/useModalLifecycle';

export type QuickAddAction = 'task' | 'schedule' | 'spark' | 'focus' | 'planner';

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (action: QuickAddAction) => void;
}

const actions = [
  { id: 'task', label: '新建任务', icon: CheckSquare },
  { id: 'schedule', label: '新建日程', icon: CalendarPlus },
  { id: 'spark', label: '随手记', icon: Lightbulb },
  { id: 'focus', label: '开始专注', icon: Focus },
  { id: 'planner', label: 'AI 规划', icon: BrainCircuit },
] as const;

export default function QuickAddSheet({ open, onClose, onSelect }: QuickAddSheetProps) {
  useModalLifecycle(open, onClose, { isolateAppMain: true });
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[41] bg-black/10"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="快速添加"
        className="pointer-events-none absolute flex flex-col items-end gap-2"
        style={{
          right: 'max(20px, calc((100vw - 32rem) / 2 + 20px))',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 136px)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {actions.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => onSelect(id)}
            className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-full border border-[var(--sf-border)] bg-[var(--sf-surface)] px-4 py-2.5 text-sm font-bold text-[var(--sf-text-primary)] shadow-lg transition-transform active:scale-95"
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </section>
    </div>,
    document.body,
  );
}
