import type { ActiveTab, ToggleableNavTab } from './types';

export type NavigationIcon = 'today' | 'tasks' | 'board' | 'timeline' | 'courses' | 'sparks' | 'settings';

export interface NavigationItem {
  id: ActiveTab;
  label: string;
  description: string;
  icon: NavigationIcon;
  toggleable: boolean;
  defaultVisible: boolean;
}

export const navigationRegistry: readonly NavigationItem[] = [
  { id: 'today', label: '今天', description: '今日节奏与概览', icon: 'today', toggleable: true, defaultVisible: true },
  { id: 'timeline', label: '时间轴', description: '日程和时间线', icon: 'timeline', toggleable: true, defaultVisible: true },
  { id: 'tasks', label: '待办', description: '任务列表', icon: 'tasks', toggleable: true, defaultVisible: true },
  { id: 'courses', label: '课程', description: '课表和课程管理', icon: 'courses', toggleable: true, defaultVisible: true },
  { id: 'board', label: '看板', description: '项目和个人看板', icon: 'board', toggleable: true, defaultVisible: false },
  { id: 'sparks', label: '灵感', description: '灵感卡片', icon: 'sparks', toggleable: true, defaultVisible: false },
  { id: 'settings', label: '设置', description: '偏好、同步和账户', icon: 'settings', toggleable: false, defaultVisible: true },
] as const;

export const toggleableNavTabs = navigationRegistry
  .filter((item): item is NavigationItem & { id: ToggleableNavTab } => item.toggleable)
  .map((item) => item.id);

export const defaultNavOrder = toggleableNavTabs.filter((id) =>
  navigationRegistry.find((item) => item.id === id)?.defaultVisible,
).concat(toggleableNavTabs.filter((id) =>
  !navigationRegistry.find((item) => item.id === id)?.defaultVisible,
));

export const defaultNavVisibility = Object.fromEntries(
  toggleableNavTabs.map((id) => [
    id,
    navigationRegistry.find((item) => item.id === id)?.defaultVisible ?? false,
  ]),
) as Record<ToggleableNavTab, boolean>;

const legacyRouteMap: Record<string, ActiveTab> = {
  dashboard: 'today',
  calendar: 'timeline',
};

export function migrateNavigationId(value: unknown): ActiveTab | null {
  if (typeof value !== 'string') return null;
  const migrated = legacyRouteMap[value] ?? value;
  return navigationRegistry.some((item) => item.id === migrated) ? migrated as ActiveTab : null;
}

export function isToggleableNavTab(value: ActiveTab | null): value is ToggleableNavTab {
  return value !== null && toggleableNavTabs.includes(value as ToggleableNavTab);
}

