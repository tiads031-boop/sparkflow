/**
 * Store 常量：初始数据、色值、默认参数
 *
 * 从 appStore.ts 原样提取，Zustand slice 共用。
 */
import type { Spark } from '../types';

/** 灵感墙初始卡片（API 不可用时的 fallback） */
export const initialSparks: Spark[] = [
  {
    id: 's1',
    text: '尝试用 Framer Motion 给卡片添加微交互动画，提升手感。',
    color: 'bg-[#cae393]',
    size: 160,
    pos: { x: 20, y: 10 },
    rot: -2,
    z: 1,
  },
  {
    id: 's2',
    text: '竞品分析：Notion 的 database 视图很强大，但对于轻量级可能过于复杂。需要保持克制。',
    color: 'bg-[#b0a8db]',
    size: 180,
    pos: { x: 170, y: 30 },
    rot: 3,
    z: 2,
  },
  {
    id: 's3',
    text: '色彩心理学：紫色代表创造力，绿色代表成长，深灰色代表专注。这个调色板选得很棒。',
    color: 'bg-white',
    size: 165,
    pos: { x: 40, y: 160 },
    rot: -1.5,
    z: 3,
  },
  {
    id: 's4',
    text: '磨砂玻璃 + 散落卡片，让信息呼吸。留白即设计本身。',
    color: 'bg-[#f4f4f4]',
    size: 170,
    pos: { x: 180, y: 200 },
    rot: 2.5,
    z: 4,
  },
];

/** TaskCard 色板 */
export const taskColors = ['dark', 'green', 'purple'] as const;

/** Spark 卡片色板 */
export const sparkColors = ['bg-[#cae393]', 'bg-[#b0a8db]', 'bg-white', 'bg-[#f4f4f4]'];

/** 番茄钟默认时长 (秒) */
export const DEFAULT_DURATION = 25 * 60;
