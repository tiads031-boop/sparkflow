import type { ReactNode } from 'react';
import AppHeader from './AppHeader';
import BottomNav, { type BottomNavItem } from './BottomNav';
import type { ActiveTab } from '../../types';

interface AppShellProps {
  children: ReactNode;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  navItems: readonly BottomNavItem[];
  onQuickAdd: () => void;
  pushEnabled: boolean;
  pushSupported: boolean;
  onTogglePush: () => void;
}

export default function AppShell(props: AppShellProps) {
  return (
    <div className="min-h-svh font-sans bg-[var(--sf-bg)] flex justify-center">
      <div className="w-full h-svh flex flex-col overflow-hidden sm:max-w-lg sm:mx-auto">
        <header className="px-5 pb-0 relative z-20 app-safe-top">
          <AppHeader
            onAddClick={props.onQuickAdd}
            pushEnabled={props.pushEnabled}
            pushSupported={props.pushSupported}
            onTogglePush={props.onTogglePush}
          />
        </header>
        <main
          className="flex-1 overflow-y-auto hide-scrollbar px-5 relative z-10"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
        >
          {props.children}
        </main>
        <BottomNav activeTab={props.activeTab} setActiveTab={props.setActiveTab} items={props.navItems} />
      </div>
    </div>
  );
}

