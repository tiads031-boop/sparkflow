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
              aria-label={tab.label}
              title={tab.label}
              className={`flex min-h-14 items-center justify-center rounded-2xl px-1 py-1 transition-all ${
                isActive
                  ? 'text-[var(--sf-text-primary)]'
                  : 'text-[var(--sf-text-tertiary)]'
              }`}
            >
              <span className={`grid h-9 w-11 place-items-center rounded-full transition-all ${
                isActive ? 'bg-[var(--sf-green)]' : 'bg-transparent'
              }`}>
                <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </GlassSurface>
  );
}
