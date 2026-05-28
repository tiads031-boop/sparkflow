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

  /** 柱状图视觉参数，按视图分组 */
  chart: {
    day: {
      /** 时间段分组步长（小时） */
      groupStep: 2,
      /** 基础高度最大值（百分比上限，防溢出） */
      baseHeightMax: 75,
      /** 基础高度（有任务时） */
      baseHeightBase: 20,
      /** 单时段任务数影响系数 */
      totalScale: 6,
      /** 基础高度（无任务时） */
      baseHeightEmpty: 10,
      /** 最小高度比例 */
      ratioMin: 0.3,
      /** 每任务增加比例 */
      ratioPerTask: 0.25,
      /** h1/h2/h3 段高度占比 */
      segmentRatios: [0.5, 0.3, 0.2],
      /** h1/h2/h3 最小高度 */
      segmentMinHeights: [10, 5, 3],
      /** h1/h2/h3 最大高度 */
      segmentMaxHeights: [75, 45, 30],
    },
    week: {
      /** 周一到周日权重系数 */
      dayWeights: [0.6, 0.8, 0.4, 1.0, 0.7, 0.5, 0.3],
      /** 基础高度最大值 */
      baseHeightMax: 60,
      /** 基础高度 */
      baseHeightBase: 20,
      /** 总任务数影响系数 */
      totalScale: 3,
      /** 无任务时的基础高度 */
      baseHeightEmpty: 15,
      /** h2/h3 段高度占比 */
      segmentRatios: [0.4, 0.3],
      /** h2/h3 最小高度 */
      segmentMinHeights: [5, 5],
      /** h2/h3 最大高度 */
      segmentMaxHeights: [50, 40],
    },
    month: {
      /** 分组步长（天） */
      groupStep: 3,
      /** 基础高度最大值（百分比上限，防溢出） */
      baseHeightMax: 75,
      /** 基础高度（有任务时） */
      baseHeightBase: 18,
      /** 单时段任务数影响系数 */
      totalScale: 4,
      /** 基础高度（无任务时） */
      baseHeightEmpty: 10,
      /** 最小高度比例 */
      ratioMin: 0.3,
      /** 每任务增加比例 */
      ratioPerTask: 0.2,
      /** h1/h2/h3 段高度占比 */
      segmentRatios: [0.5, 0.3, 0.2],
      /** h1/h2/h3 最小高度 */
      segmentMinHeights: [8, 5, 3],
      /** h1/h2/h3 最大高度 */
      segmentMaxHeights: [70, 40, 25],
    },
  } as const,

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
