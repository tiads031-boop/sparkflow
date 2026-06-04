import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import type { ActiveTab, ChartView, NavVisibility, ToggleableNavTab } from '../types';
import { V4 } from '../v4config';

const NAV_VISIBILITY_STORAGE_KEY = 'sparkflow.navVisibility';

const toggleableNavTabs: ToggleableNavTab[] = [
  'dashboard',
  'tasks',
  'board',
  'calendar',
  'courses',
  'sparks',
];

const defaultNavVisibility: NavVisibility = {
  dashboard: true,
  tasks: true,
  board: true,
  calendar: true,
  courses: true,
  sparks: true,
};

function readStoredNavVisibility(): NavVisibility {
  if (typeof window === 'undefined') return defaultNavVisibility;

  try {
    const raw = window.localStorage.getItem(NAV_VISIBILITY_STORAGE_KEY);
    if (!raw) return defaultNavVisibility;

    const parsed = JSON.parse(raw) as Partial<Record<ToggleableNavTab, unknown>>;
    return toggleableNavTabs.reduce<NavVisibility>(
      (acc, tab) => ({
        ...acc,
        [tab]: typeof parsed[tab] === 'boolean' ? parsed[tab] : defaultNavVisibility[tab],
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

function isNavTabVisible(tab: ActiveTab, navVisibility: NavVisibility): boolean {
  return tab === 'settings' || navVisibility[tab as ToggleableNavTab];
}

function getFallbackActiveTab(navVisibility: NavVisibility): ActiveTab {
  if (navVisibility.tasks) return 'tasks';
  return toggleableNavTabs.find((tab) => navVisibility[tab]) ?? 'settings';
}

const initialNavVisibility = readStoredNavVisibility();

export interface UISlice {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  navVisibility: NavVisibility;
  setNavVisibility: (tab: ToggleableNavTab, visible: boolean) => void;
  toggleNavVisibility: (tab: ToggleableNavTab) => void;

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

  chartView: V4.chartDefaultView as ChartView,
  setChartView: (view) => set({ chartView: view }),

  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),

  calendarHeaderExpanded: false,
  setCalendarHeaderExpanded: (expanded) => set({ calendarHeaderExpanded: expanded }),
});
