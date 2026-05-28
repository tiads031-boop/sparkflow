/**
 * UI 状态 Slice
 *
 * 导航、视图模式、日期选择等纯 UI 状态。
 * 零外部依赖，不含副作用。
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import type { ActiveTab, ChartView } from '../types';
import { V4 } from '../v4config';

export interface UISlice {
  /** 当前底部导航标签 */
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  /** V4 Dashboard: 图表视图模式 */
  chartView: ChartView;
  setChartView: (view: ChartView) => void;

  /** V4 Calendar: 选中日期 */
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;

  /** V4 Calendar: 日历头展开状态 */
  calendarHeaderExpanded: boolean;
  setCalendarHeaderExpanded: (expanded: boolean) => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  activeTab: 'tasks',
  setActiveTab: (tab) => set({ activeTab: tab }),

  chartView: V4.chartDefaultView as ChartView,
  setChartView: (view) => set({ chartView: view }),

  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),

  calendarHeaderExpanded: false,
  setCalendarHeaderExpanded: (expanded) => set({ calendarHeaderExpanded: expanded }),
});
