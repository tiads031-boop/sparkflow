import { Bell, BellOff } from 'lucide-react';

interface AppHeaderProps {
  pushEnabled: boolean;
  pushSupported: boolean;
  onTogglePush: () => void;
}

export default function AppHeader({ pushEnabled, pushSupported, onTogglePush }: AppHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="text-xl font-black tracking-tighter italic select-none text-[var(--sf-text-primary)]">
        SparkFlow<span className="text-[var(--sf-marker-green)]">.</span>
      </div>
      <div className="flex gap-2">
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
