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
      className="fixed left-1/2 z-40 h-[70px] w-[calc(100%-20px)] max-w-[492px] -translate-x-1/2 overflow-hidden px-2 py-1.5"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 9px)' }}
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
              className={`flex min-h-[56px] items-center justify-center rounded-[19px] px-1 py-1 transition-all ${
                isActive
                  ? 'bg-[linear-gradient(180deg,rgba(228,244,205,.82),rgba(216,238,183,.68))] text-[var(--sf-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,.72),0_5px_14px_rgba(92,116,64,.08)]'
                  : 'text-[var(--sf-text-tertiary)]'
              }`}
            >
              <span className="grid h-8 w-11 place-items-center">
                <Icon size={22} strokeWidth={isActive ? 2 : 1.65} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </GlassSurface>
  );
}
