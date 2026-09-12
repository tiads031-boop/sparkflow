import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import type { ActiveTab, ChartView, NavOrder, NavVisibility, ToggleableNavTab } from '../types';
import { V4 } from '../v4config';
import {
  defaultNavOrder,
  defaultNavVisibility,
  isToggleableNavTab,
  migrateNavigationId,
  toggleableNavTabs,
} from '../navigation';

const NAV_VISIBILITY_STORAGE_KEY = 'sparkflow.navVisibility';
const NAV_ORDER_STORAGE_KEY = 'sparkflow.navOrder';

function readStoredNavVisibility(): NavVisibility {
  if (typeof window === 'undefined') return defaultNavVisibility;

  try {
    const raw = window.localStorage.getItem(NAV_VISIBILITY_STORAGE_KEY);
    if (!raw) return defaultNavVisibility;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const migrated = new Map<ToggleableNavTab, boolean>();
    Object.entries(parsed).forEach(([key, value]) => {
      const id = migrateNavigationId(key);
      if (isToggleableNavTab(id) && typeof value === 'boolean') migrated.set(id, value);
    });
    return toggleableNavTabs.reduce<NavVisibility>(
      (acc, tab) => ({
        ...acc,
        [tab]: migrated.get(tab) ?? defaultNavVisibility[tab],
      }),
      { ...defaultNavVisibility },
    );
  } catch {
    return defaultNavVisibility;
  }
}

function writeStoredNavVisibility(navVisibility: NavVisibility) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(NAV_VISIBILITY_STORAGE_KEY, JSON.stringify(navVisibility));
  } catch {
    // Ignore storage failures so UI toggles still work in restricted environments.
  }
}

function readStoredNavOrder(): NavOrder {
  if (typeof window === 'undefined') return defaultNavOrder;

  try {
    const raw = window.localStorage.getItem(NAV_ORDER_STORAGE_KEY);
    if (!raw) return defaultNavOrder;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultNavOrder;

    const storedTabs = parsed
      .map(migrateNavigationId)
      .filter(isToggleableNavTab)
      .filter((tab, index, values) => values.indexOf(tab) === index);
    const missingTabs = toggleableNavTabs.filter((tab) => !storedTabs.includes(tab));
    return [...storedTabs, ...missingTabs];
  } catch {
    return defaultNavOrder;
  }
}

function writeStoredNavOrder(navOrder: NavOrder) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(navOrder));
  } catch {
    // Ignore storage failures so the current session can still reorder navigation.
  }
}

function isNavTabVisible(tab: ActiveTab, navVisibility: NavVisibility): boolean {
  return tab === 'settings' || navVisibility[tab as ToggleableNavTab];
}

function getFallbackActiveTab(navVisibility: NavVisibility): ActiveTab {
  if (navVisibility.today) return 'today';
  if (navVisibility.tasks) return 'tasks';
  return toggleableNavTabs.find((tab) => navVisibility[tab]) ?? 'settings';
}

const initialNavVisibility = readStoredNavVisibility();
const initialNavOrder = readStoredNavOrder();

export interface UISlice {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  navVisibility: NavVisibility;
  navOrder: NavOrder;
  setNavVisibility: (tab: ToggleableNavTab, visible: boolean) => void;
  toggleNavVisibility: (tab: ToggleableNavTab) => void;
  moveNavItem: (tab: ToggleableNavTab, direction: 'up' | 'down') => void;

  chartView: ChartView;
  setChartView: (view: ChartView) => void;

  selectedDate: Date;
  setSelectedDate: (date: Date) => void;

  calendarHeaderExpanded: boolean;
  setCalendarHeaderExpanded: (expanded: boolean) => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  activeTab: getFallbackActiveTab(initialNavVisibility),
  setActiveTab: (tab) => set((state) => ({
    activeTab: isNavTabVisible(tab, state.navVisibility)
      ? tab
      : getFallbackActiveTab(state.navVisibility),
  })),

  navVisibility: initialNavVisibility,
  navOrder: initialNavOrder,
  setNavVisibility: (tab, visible) => set((state) => {
    const navVisibility = { ...state.navVisibility, [tab]: visible };
    writeStoredNavVisibility(navVisibility);

    return {
      navVisibility,
      activeTab: isNavTabVisible(state.activeTab, navVisibility)
        ? state.activeTab
        : getFallbackActiveTab(navVisibility),
    };
  }),
  toggleNavVisibility: (tab) => set((state) => {
    const navVisibility = { ...state.navVisibility, [tab]: !state.navVisibility[tab] };
    writeStoredNavVisibility(navVisibility);

    return {
      navVisibility,
      activeTab: isNavTabVisible(state.activeTab, navVisibility)
        ? state.activeTab
        : getFallbackActiveTab(navVisibility),
    };
  }),
  moveNavItem: (tab, direction) => set((state) => {
    const currentIndex = state.navOrder.indexOf(tab);
    if (currentIndex < 0) return state;

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= state.navOrder.length) return state;

    const navOrder = [...state.navOrder];
    [navOrder[currentIndex], navOrder[nextIndex]] = [navOrder[nextIndex], navOrder[currentIndex]];
    writeStoredNavOrder(navOrder);

    return { navOrder };
  }),

  chartView: V4.chartDefaultView as ChartView,
  setChartView: (view) => set({ chartView: view }),

  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),

  calendarHeaderExpanded: false,
  setCalendarHeaderExpanded: (expanded) => set({ calendarHeaderExpanded: expanded }),
});
