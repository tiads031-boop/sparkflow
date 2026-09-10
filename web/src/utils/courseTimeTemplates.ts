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
}

const STORAGE_PREFIX = 'sparkflow.course-time-templates.v1.';

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
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey(adapterId)) || '[]');
    return Array.isArray(parsed)
      ? parsed.map(normalizeTemplate).filter((template): template is CourseTimeTemplate => template !== null)
      : [];
  } catch {
    return [];
  }
}

export function saveCourseTimeTemplates(adapterId: string, templates: readonly CourseTimeTemplate[], storage: Pick<Storage, 'setItem'> = localStorage): void {
  if (!adapterId) throw new Error('请先选择学校，再保存作息模板');
  storage.setItem(storageKey(adapterId), JSON.stringify(templates));
}
