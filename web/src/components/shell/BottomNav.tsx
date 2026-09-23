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
      className="fixed left-1/2 z-40 h-[64px] w-[calc(100%_-_24px)] max-w-[488px] -translate-x-1/2 px-2 py-1.5"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
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
              aria-label={tab.label}
              title={tab.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-12 items-center justify-center rounded-2xl px-1 py-1 transition-all ${
                isActive
                  ? 'text-[var(--sf-text-primary)]'
                  : 'text-[var(--sf-text-tertiary)]'
              }`}
            >
              <span className={`grid h-10 w-12 place-items-center rounded-2xl transition-all ${
                isActive ? 'bg-[var(--sf-green)]' : 'bg-transparent'
              }`}>
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.9} />
              </span>
            </button>
          );
        })}
      </div>
    </GlassSurface>
  );
}
