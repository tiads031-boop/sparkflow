/**
 * V4 Dashboard & Calendar 配置
 * 读取自 sparkflow-v4-dashboard-calendar-params.json（原型参数快照）
 */
import paramsJson from './sparkflow-v4-dashboard-calendar-params.json';

export const V4 = {
  /** 时间线每小时像素高度 */
  hourHeight: (paramsJson.params.hourHeight as string) || '60px',
  /** 时间线起始小时 (0-23) */
  timelineStartHour: (paramsJson.params.timelineStartHour as number) ?? 0,
  /** 时间线结束小时 (1-24) */
  timelineEndHour: (paramsJson.params.timelineEndHour as number) ?? 24,
  /** 拖拽磁吸粒度 (分钟) */
  snapMinutes: (paramsJson.params.snapMinutes as number) ?? 30,
  /** 任务块圆角 */
  taskBlockRadius: (paramsJson.params.taskBlockRadius as string) || '11px',
  /** 日历头默认展开 */
  calendarHeaderDefaultExpanded: (paramsJson.params.calendarHeaderDefaultExpanded as boolean) ?? false,
  /** 图表默认视图 */
  chartDefaultView: (paramsJson.params.chartDefaultView as string) === 'month' ? 'month'
    : (paramsJson.params.chartDefaultView as string) === 'day' ? 'day' : 'week',

  // 色值
  colors: {
    dark: (paramsJson.colors.dark as string) || '#242424',
    green: (paramsJson.colors.green as string) || '#cae393',
    purple: (paramsJson.colors.purple as string) || '#b0a8db',
    bg: (paramsJson.colors.bg as string) || '#f4f4f6',
  },

  /** 目标设备 */
  deviceTarget: (paramsJson.deviceTarget as string) || 'redmi-k70',
  /** Viewport CSS 描述 */
  viewportCSS: (paramsJson.viewportCSS as string) || '393×852',
};
