import type { ReactNode } from 'react';
import BottomNav, { type BottomNavItem } from './BottomNav';
import FloatingActionButton from './FloatingActionButton';
import type { ActiveTab } from '../../types';
import GlassProvider from '../ui/GlassProvider';

interface AppShellProps {
  children: ReactNode;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  navItems: readonly BottomNavItem[];
  onQuickAdd: () => void;
  onPlannerVoice: () => void;
  edgeToEdge?: boolean;
}

export default function AppShell(props: AppShellProps) {
  return (
    <GlassProvider>
      <div className="flex min-h-svh justify-center bg-[var(--sf-bg)] font-sans">
        <div className="flex h-svh w-full flex-col overflow-hidden sm:mx-auto sm:max-w-lg">
          <main
            data-sf-app-main
            className={`app-safe-top relative flex-1 overflow-y-auto hide-scrollbar ${props.edgeToEdge ? 'px-0' : 'px-[18px]'}`}
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 106px)',
              scrollPaddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 106px)',
            }}
          >
            {props.children}
          </main>
          <FloatingActionButton onPress={props.onQuickAdd} onLongPress={props.onPlannerVoice} />
          <BottomNav activeTab={props.activeTab} setActiveTab={props.setActiveTab} items={props.navItems} />
        </div>
      </div>
    </GlassProvider>
  );
}
