import type { ReactNode } from 'react';
import AppHeader from './AppHeader';
import BottomNav, { type BottomNavItem } from './BottomNav';
import FloatingActionButton from './FloatingActionButton';
import type { ActiveTab } from '../../types';

interface AppShellProps {
  children: ReactNode;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  navItems: readonly BottomNavItem[];
  onQuickAdd: () => void;
  onPlannerVoice: () => void;
  pushEnabled: boolean;
  pushSupported: boolean;
  onTogglePush: () => void;
  immersive?: boolean;
}

export default function AppShell(props: AppShellProps) {
  return (
    <div className="min-h-svh font-sans bg-[var(--sf-bg)] flex justify-center">
      <div className="w-full h-svh flex flex-col overflow-hidden sm:max-w-lg sm:mx-auto">
        {!props.immersive && (
          <header className="px-5 pb-0 relative z-20 app-safe-top">
            <AppHeader
              pushEnabled={props.pushEnabled}
              pushSupported={props.pushSupported}
              onTogglePush={props.onTogglePush}
            />
          </header>
        )}
        <main
          data-sf-app-main
          className={`flex-1 overflow-y-auto hide-scrollbar relative ${props.immersive ? 'px-0' : 'px-5'}`}
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
            scrollPaddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
          }}
        >
          {props.children}
        </main>
        <FloatingActionButton onPress={props.onQuickAdd} onLongPress={props.onPlannerVoice} />
        <BottomNav activeTab={props.activeTab} setActiveTab={props.setActiveTab} items={props.navItems} />
      </div>
    </div>
  );
}
