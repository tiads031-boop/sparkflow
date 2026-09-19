import { useEffect, useState } from 'react';
import { BrainCircuit, CalendarPlus, CheckSquare, Clock3, Focus, Lightbulb, X } from 'lucide-react';
import InspirationCaptureSheet from '../records/InspirationCaptureSheet';

export type QuickAddAction = 'task' | 'schedule' | 'spark' | 'temporary' | 'focus' | 'planner';

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (action: QuickAddAction) => void;
}

const actions = [
  { id: 'task', label: '新建任务', icon: CheckSquare, enabled: true },
  { id: 'schedule', label: '新建日程', icon: CalendarPlus, enabled: true },
  { id: 'spark', label: '随手记', icon: Lightbulb, enabled: true },
  { id: 'temporary', label: '临时安排', icon: Clock3, enabled: true },
  { id: 'planner', label: 'AI 规划与调整', icon: BrainCircuit, enabled: true },
  { id: 'focus', label: '开始专注', icon: Focus, enabled: true },
] as const;

export default function QuickAddSheet({ open, onClose, onSelect }: QuickAddSheetProps) {
  const [captureMode, setCaptureMode] = useState(false);


  useEffect(() => {
    if (!open) {
      setCaptureMode(false);

    }
  }, [open]);

  const handleSelect = (action: QuickAddAction) => {
    if (action === 'spark') {
      setCaptureMode(true);
      return;
    }
    onSelect(action);
  };

  if (!open) return null;
  if (captureMode) {
    return (
      <InspirationCaptureSheet
        open
        onClose={() => {
          setCaptureMode(false);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" role="presentation" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="快速添加"
        className="w-full max-w-lg rounded-t-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] animate-slide-up-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--sf-text-primary)]">快速添加</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-full p-2 bg-[var(--sf-bg)]"><X size={16} /></button>
        </div>

        <div className="space-y-2">
          {actions.map(({ id, label, icon: Icon, enabled }) => (
            <button
              type="button"
              key={id}
              disabled={!enabled}
              onClick={() => handleSelect(id)}
              className="w-full flex items-center gap-3 rounded-[var(--sf-radius-sm)] border border-[var(--sf-border)] px-4 py-3 text-left disabled:opacity-40"
            >
              <Icon size={18} />
              <span className="flex-1 text-sm font-semibold">{label}</span>
              {!enabled && <span className="text-[10px] text-[var(--sf-text-tertiary)]">后续开放</span>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
