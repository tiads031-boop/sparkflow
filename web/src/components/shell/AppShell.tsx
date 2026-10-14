import type { ReactNode } from 'react';
import BottomNav, { type BottomNavItem } from './BottomNav';
import FloatingActionButton from './FloatingActionButton';
import type { ActiveTab } from '../../types';
import GlassProvider from '../ui/GlassProvider';
import { useLayoutEffect, useRef } from 'react';

interface AppShellProps {
  children: ReactNode;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  navItems: readonly BottomNavItem[];
  onQuickAdd: () => void;
  onPlannerVoice: () => void;
  edgeToEdge?: boolean;
  scrollKey: string;
}

export default function AppShell(props: AppShellProps) {
  const mainRef = useRef<HTMLElement>(null);
  const positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const target = positions.current.get(props.scrollKey) ?? 0;
    let restoring = true;
    const restore = () => {
      if (!restoring) return;
      main.scrollTop = target;
      if (main.scrollHeight - main.clientHeight >= target) {
        restoring = false;
        observer.disconnect();
      }
    };
    const observer = new MutationObserver(restore);
    observer.observe(main, { childList: true, subtree: true });
    restore();
    const save = () => { if (!restoring) positions.current.set(props.scrollKey, main.scrollTop); };
    const cancelRestore = () => { restoring = false; observer.disconnect(); };
    main.addEventListener('scroll', save);
    main.addEventListener('wheel', cancelRestore, { passive: true });
    main.addEventListener('touchstart', cancelRestore, { passive: true });
    main.addEventListener('keydown', cancelRestore);
    return () => {
      observer.disconnect();
      main.removeEventListener('scroll', save);
      main.removeEventListener('wheel', cancelRestore);
      main.removeEventListener('touchstart', cancelRestore);
      main.removeEventListener('keydown', cancelRestore);
    };
  }, [props.scrollKey]);
  return (
    <GlassProvider>
      <div className="flex min-h-svh justify-center bg-[var(--sf-bg)] font-sans">
        <div className="flex h-svh w-full flex-col overflow-hidden sm:mx-auto sm:max-w-lg">
          <main
            ref={mainRef}
            data-sf-app-main
            className={`app-safe-top relative flex-1 overflow-y-auto hide-scrollbar ${props.edgeToEdge ? 'px-0' : 'px-5'}`}
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 166px)',
              scrollPaddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 166px)',
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
