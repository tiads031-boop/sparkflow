import { Bell, BellOff, Plus } from 'lucide-react';

interface AppHeaderProps {
  onAddClick: () => void;
  pushEnabled: boolean;
  pushSupported: boolean;
  onTogglePush: () => void;
}

export default function AppHeader({ onAddClick, pushEnabled, pushSupported, onTogglePush }: AppHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="text-xl font-black tracking-tighter italic select-none text-[var(--sf-text-primary)]">
        SparkFlow<span className="text-[var(--sf-marker-green)]">.</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAddClick}
          aria-label="快速添加"
          className="w-9 h-9 rounded-full bg-[var(--sf-accent)] text-[var(--sf-bg)] flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={18} />
        </button>
        {pushSupported && (
          <button
            type="button"
            onClick={onTogglePush}
            aria-label={pushEnabled ? '关闭推送通知' : '开启推送通知'}
            className={`w-9 h-9 rounded-full flex items-center justify-center relative transition-colors ${
              pushEnabled ? 'bg-[var(--sf-marker-green)] text-[var(--sf-text-primary)]' : 'bg-[var(--sf-marker-purple)]/30 text-[var(--sf-text-tertiary)]'
            }`}
          >
            {pushEnabled ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}

