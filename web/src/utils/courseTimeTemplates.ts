import { normalizeCourseTime, parseTimeSlots, type ImportedTimeSlot } from './schoolImport.ts';

export interface CourseTimeGeneratorOptions {
  firstStart: string;
  lessonMinutes: number;
  breakMinutes: number;
  sectionCount: number;
  longBreakAfter?: number;
  longBreakMinutes?: number;
}

export interface CourseTimeTemplate {
  id: string;
  name: string;
  slots: ImportedTimeSlot[];
  builtIn?: boolean;
  note?: string;
}

const STORAGE_PREFIX = 'sparkflow.course-time-templates.v1.';

const JISU_ADAPTER_IDS = new Set(['jisu_external', 'jisu_campus']);

const JISU_SUMMER_TEMPLATE: CourseTimeTemplate = {
  id: 'builtin-jisu-summer-2024-2025',
  name: '吉林外国语大学 · 夏季作息',
  builtIn: true,
  note: '第 3–4 节按信育楼（四教）、敏行楼（实验楼）、实验实训中心、国际交流中心、体育馆时段；文育楼、行育楼、忠育楼、地球村、世析大厦需各顺延 10 分钟。',
  slots: [
    { number: 1, startTime: '08:00', endTime: '08:45' },
    { number: 2, startTime: '08:55', endTime: '09:40' },
    { number: 3, startTime: '10:00', endTime: '10:45' },
    { number: 4, startTime: '10:55', endTime: '11:40' },
    { number: 5, startTime: '13:30', endTime: '14:15' },
    { number: 6, startTime: '14:25', endTime: '15:10' },
    { number: 7, startTime: '15:20', endTime: '16:05' },
    { number: 8, startTime: '16:10', endTime: '16:55' },
    { number: 9, startTime: '17:40', endTime: '18:25' },
    { number: 10, startTime: '18:35', endTime: '19:20' },
    { number: 11, startTime: '19:30', endTime: '20:15' },
    { number: 12, startTime: '20:25', endTime: '21:10' },
  ],
};

const JISU_WINTER_TEMPLATE: CourseTimeTemplate = {
  id: 'builtin-jisu-winter-2024-2025',
  name: '吉林外国语大学 · 冬季作息',
  builtIn: true,
  note: '第 3–4 节按信育楼（四教）、敏行楼（实验楼）、实验实训中心、国际交流中心、体育馆时段；文育楼、行育楼、忠育楼、地球村、世析大厦需各提前 10 分钟。',
  slots: [
    { number: 1, startTime: '08:00', endTime: '08:45' },
    { number: 2, startTime: '08:55', endTime: '09:40' },
    { number: 3, startTime: '10:10', endTime: '10:55' },
    { number: 4, startTime: '11:05', endTime: '11:50' },
    { number: 5, startTime: '13:10', endTime: '13:55' },
    { number: 6, startTime: '14:00', endTime: '14:45' },
    { number: 7, startTime: '14:55', endTime: '15:40' },
    { number: 8, startTime: '15:45', endTime: '16:30' },
    { number: 9, startTime: '17:40', endTime: '18:25' },
    { number: 10, startTime: '18:35', endTime: '19:20' },
    { number: 11, startTime: '19:30', endTime: '20:15' },
    { number: 12, startTime: '20:25', endTime: '21:10' },
  ],
};

function cloneTemplate(template: CourseTimeTemplate): CourseTimeTemplate {
  return { ...template, slots: template.slots.map(slot => ({ ...slot })) };
}

export function builtInCourseTimeTemplates(adapterId: string): CourseTimeTemplate[] {
  return JISU_ADAPTER_IDS.has(adapterId)
    ? [cloneTemplate(JISU_SUMMER_TEMPLATE), cloneTemplate(JISU_WINTER_TEMPLATE)]
    : [];
}

function toMinutes(time: string): number {
  const normalized = normalizeCourseTime(time);
  if (!normalized) throw new Error('首节开始时间无效');
  const [hour, minute] = normalized.split(':').map(Number);
  return hour * 60 + minute;
}

function formatMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function integerInRange(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label}必须为 ${minimum}–${maximum} 的整数`);
  }
  return value;
}

/** Generate a same-day school timetable. The long break replaces the normal break after one section. */
export function generateCourseTimeSlots(options: CourseTimeGeneratorOptions): ImportedTimeSlot[] {
  let cursor = toMinutes(options.firstStart);
  const lessonMinutes = integerInRange(options.lessonMinutes, 1, 240, '每节时长');
  const breakMinutes = integerInRange(options.breakMinutes, 0, 240, '普通课间');
  const sectionCount = integerInRange(options.sectionCount, 1, 30, '节数');
  const hasLongBreak = options.longBreakAfter !== undefined;
  const longBreakAfter = hasLongBreak
    ? integerInRange(options.longBreakAfter!, 1, Math.max(1, sectionCount - 1), '大课间位置')
    : undefined;
  if (hasLongBreak && sectionCount < 2) throw new Error('只有一节课时不能设置大课间');
  const longBreakMinutes = hasLongBreak
    ? integerInRange(options.longBreakMinutes ?? 0, 0, 720, '大课间时长')
    : breakMinutes;
  const slots: ImportedTimeSlot[] = [];

  for (let index = 0; index < sectionCount; index += 1) {
    const end = cursor + lessonMinutes;
    if (end >= 24 * 60) throw new Error('生成的作息跨越了当天午夜，请调整开始时间、节数或间隔');
    slots.push({ number: index + 1, startTime: formatMinutes(cursor), endTime: formatMinutes(end) });
    cursor = end + (index + 1 === longBreakAfter ? longBreakMinutes : breakMinutes);
  }
  return slots;
}

function normalizeTemplate(value: unknown): CourseTimeTemplate | null {
  if (!value || typeof value !== 'object') return null;
  const template = value as Partial<CourseTimeTemplate>;
  if (typeof template.id !== 'string' || !template.id || typeof template.name !== 'string' || !template.name.trim() || !Array.isArray(template.slots)) return null;
  try {
    const slots = parseTimeSlots(template.slots.map(slot => `${slot?.number} ${slot?.startTime}-${slot?.endTime}`).join('\n'));
    if (!slots.length) return null;
    return {
      id: template.id,
      name: template.name.trim(),
      slots: slots.map(slot => ({ number: slot.number, startTime: slot.start, endTime: slot.end })),
    };
  } catch {
    return null;
  }
}

function storageKey(adapterId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(adapterId)}`;
}

/** Invalid/corrupt browser data is ignored instead of blocking the import wizard. */
export function loadCourseTimeTemplates(adapterId: string, storage: Pick<Storage, 'getItem'> = localStorage): CourseTimeTemplate[] {
  if (!adapterId) return [];
  const builtIns = builtInCourseTimeTemplates(adapterId);
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey(adapterId)) || '[]');
    const saved = Array.isArray(parsed)
      ? parsed.map(normalizeTemplate).filter((template): template is CourseTimeTemplate => template !== null)
      : [];
    const builtInIds = new Set(builtIns.map(template => template.id));
    return [...builtIns, ...saved.filter(template => !builtInIds.has(template.id))];
  } catch {
    return builtIns;
  }
}

export function saveCourseTimeTemplates(adapterId: string, templates: readonly CourseTimeTemplate[], storage: Pick<Storage, 'setItem'> = localStorage): void {
  if (!adapterId) throw new Error('请先选择学校，再保存作息模板');
  const customTemplates = templates
    .filter(template => !template.builtIn)
    .map(({ id, name, slots }) => ({ id, name, slots }));
  storage.setItem(storageKey(adapterId), JSON.stringify(customTemplates));
}
