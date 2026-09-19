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
      className="fixed bottom-0 left-1/2 z-40 w-full -translate-x-1/2 border-t border-black/[0.06] bg-[var(--sf-bg)]/95 px-2 pt-1.5 backdrop-blur-xl sm:max-w-lg"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)' }}
    >
      <div className="grid grid-cols-5">
        {items.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-bold transition-all ${
                isActive
                  ? 'text-[var(--sf-text-primary)]'
                  : 'text-[var(--sf-text-tertiary)]'
              }`}
            >
              <span className={`grid h-7 w-9 place-items-center rounded-full transition-all ${
                isActive ? 'bg-[#cae393]' : 'bg-transparent'
              }`}>
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
