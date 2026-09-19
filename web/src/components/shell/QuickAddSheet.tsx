import { useEffect, useRef, useState } from 'react';
import { BrainCircuit, CalendarPlus, CheckSquare, Clock3, Focus, Lightbulb, X } from 'lucide-react';
import { createInspiration } from '../../api/inspirations';

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
  const [captureText, setCaptureText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      setCaptureMode(false);
      setCaptureText('');
      setSaving(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (captureMode) textareaRef.current?.focus();
  }, [captureMode]);

  const handleSelect = (action: QuickAddAction) => {
    if (action === 'spark') {
      setCaptureMode(true);
      setError(null);
      return;
    }
    onSelect(action);
  };

  const handleCapture = async () => {
    const value = captureText.trim();
    if (!value || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createInspiration(value);
      window.dispatchEvent(new CustomEvent('sparkflow:records-changed'));
      setCaptureText('');
      onClose();
    } catch (err: any) {
      setError(err?.message || '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" role="presentation" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={captureMode ? '随手记' : '快速添加'}
        className="w-full max-w-lg rounded-t-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] animate-slide-up-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--sf-text-primary)]">{captureMode ? '随手记' : '快速添加'}</h2>
            {captureMode && <p className="mt-1 text-xs text-[var(--sf-text-tertiary)]">只写正文也可以，其他信息以后再补。</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-full p-2 bg-[var(--sf-bg)]"><X size={16} /></button>
        </div>

        {captureMode ? (
          <div className="space-y-3">
            <textarea
              ref={textareaRef}
              value={captureText}
              onChange={(event) => setCaptureText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') handleCapture();
              }}
              placeholder="记下现在想到的东西……"
              className="min-h-36 w-full resize-none rounded-[var(--sf-radius-md)] border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--sf-text-primary)]"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => setCaptureMode(false)} className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--sf-text-secondary)]">返回</button>
              <button
                type="button"
                disabled={!captureText.trim() || saving}
                onClick={handleCapture}
                className="rounded-full bg-[var(--sf-text-primary)] px-5 py-2.5 text-sm font-bold text-[var(--sf-surface)] disabled:opacity-40"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        ) : (
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
        )}
      </section>
    </div>
  );
}
