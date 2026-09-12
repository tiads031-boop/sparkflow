import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import type { ActiveTab } from '../../types';

export interface BottomNavItem {
  id: ActiveTab;
  label: string;
  icon: ComponentType<LucideProps>;
}

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  items: readonly BottomNavItem[];
}

export default function BottomNav({ activeTab, setActiveTab, items }: BottomNavProps) {
  return (
    <nav
      aria-label="主导航"
      className="fixed left-1/2 -translate-x-1/2 bg-[var(--sf-text-primary)] rounded-full px-1.5 py-1.5 flex items-center gap-1 shadow-[0_20px_40px_rgba(0,0,0,0.3)] z-40"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
    >
      {items.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            aria-current={isActive ? 'page' : undefined}
            className={`relative p-2.5 rounded-full transition-all duration-300 ${
              isActive ? 'bg-[var(--sf-surface)] text-[var(--sf-text-primary)]' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            {isActive && <span className="absolute -top-0.5 right-0 w-2 h-2 bg-[var(--sf-marker-green)] rounded-full border-2 border-[var(--sf-text-primary)]" />}
          </button>
        );
      })}
    </nav>
  );
}

