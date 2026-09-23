import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import type { ActiveTab } from '../../types';
import GlassSurface from '../ui/GlassSurface';

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
    <GlassSurface
      as="nav"
      variant="nav"
      aria-label="主导航"
      className="fixed bottom-0 left-1/2 z-40 h-[calc(74px+env(safe-area-inset-bottom,0px))] w-full max-w-lg -translate-x-1/2 rounded-none border-x-0 border-b-0 px-2 pb-[env(safe-area-inset-bottom,0px)] pt-1.5"
      style={{ bottom: 0 }}
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
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 text-[10px] font-extrabold transition-all ${
                isActive
                  ? 'text-[var(--sf-text-primary)]'
                  : 'text-[var(--sf-text-tertiary)]'
              }`}
            >
              <span className={`grid h-7 w-10 place-items-center rounded-full transition-all ${
                isActive ? 'bg-[var(--sf-green)]' : 'bg-transparent'
              }`}>
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </GlassSurface>
  );
}
