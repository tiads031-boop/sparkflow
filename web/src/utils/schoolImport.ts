import type { ScheduleBackup } from './courseSchedule';
export interface ImportedSchoolCourse {
  sourceId?: string;
  name: string; teacher?: string; position?: string; day: number; weeks: number[];
  startSection?: number; endSection?: number; isCustomTime?: boolean; customStartTime?: string; customEndTime?: string;
}
export interface ImportedTimeSlot { number: number; startTime: string; endTime: string }
export interface SchoolImportData { courses: ImportedSchoolCourse[]; timeSlots?: ImportedTimeSlot[]; config?: { semesterStartDate?: string; semesterTotalWeeks?: number; termId?: string; currentSemesterId?: string }; }

export interface ParsedTimeSlot { number: number; start: string; end: string }
export interface SchoolImportSummary {
  scheduleEntryCount: number;
  uniqueCourseCount: number;
  generatedEventCount: number;
  excludedEventCount: number;
}

/** Normalize common timetable time variants to the API contract (HH:mm). */
export function normalizeCourseTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/[：﹕]/g, ':');
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Parse editable school periods while accepting common Chinese and typographic connectors. */
export function parseTimeSlots(slotsText: string): ParsedTimeSlot[] {
  const slots = new Map<number, ParsedTimeSlot>();
  for (const line of slotsText.split(/\r?\n/).filter(value => value.trim())) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(\d+)\s+(.+?)\s*(?:-|–|—|－|~|～|至)\s*(.+)$/);
    if (!match) throw new Error(`节次“${trimmed}”格式无效，应为“1 08:00-08:45”`);

    const number = Number(match[1]);
    if (!Number.isInteger(number) || number < 1 || number > 30) {
      throw new Error(`节次编号 ${match[1]} 无效，必须为 1–30`);
    }
    if (slots.has(number)) throw new Error(`第 ${number} 节重复，请删除或修改重复节次`);

    const start = normalizeCourseTime(match[2]);
    const end = normalizeCourseTime(match[3]);
    if (!start || !end) throw new Error(`第 ${number} 节时间格式无效，应使用 24 小时制 HH:mm`);
    if (end <= start) {
      throw new Error(`第 ${number} 节结束时间 ${end} 必须晚于开始时间 ${start}，请修正后再查看预览`);
    }
    slots.set(number, { number, start, end });
  }
  return [...slots.values()];
}

/** Return every numbered period referenced by non-custom-time courses. */
export function requiredSectionNumbers(data: SchoolImportData): number[] {
  const numbers = new Set<number>();
  for (const course of data.courses) {
    if (course.isCustomTime) continue;
    const first = course.startSection;
    const last = course.endSection;
    if (!Number.isInteger(first) || !Number.isInteger(last) || first! < 1 || last! > 30 || last! < first!) continue;
    for (let number = first!; number <= last!; number += 1) numbers.add(number);
  }
  return [...numbers].sort((a, b) => a - b);
}

/** Serialize structured school periods to the text format accepted by schoolBackup. */
export function serializeTimeSlots(slots: readonly ImportedTimeSlot[]): string {
  const serialized = slots.map(slot => `${slot.number} ${slot.startTime}-${slot.endTime}`).join('\n');
  return parseTimeSlots(serialized)
    .sort((a, b) => a.number - b.number)
    .map(slot => `${slot.number} ${slot.start}-${slot.end}`)
    .join('\n');
}

/** Produce stable preview counters without exposing the backup's internal model. */
export function summarizeSchoolImport(data: SchoolImportData, backup: ScheduleBackup): SchoolImportSummary {
  const generatedEventCount = backup.courses.reduce((total, course) => total + course.events.length, 0);
  const plannedEventCount = data.courses.reduce((total, course) => total + new Set(course.weeks).size, 0);
  return {
    scheduleEntryCount: data.courses.length,
    uniqueCourseCount: new Set(data.courses.map(course => course.name.trim()).filter(Boolean)).size,
    generatedEventCount,
    excludedEventCount: Math.max(0, plannedEventCount - generatedEventCount),
  };
}

function isCalendarDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function schoolBackup(data: SchoolImportData, name: string, start: string, end: string, slotsText: string): ScheduleBackup {
  if (!data || !Array.isArray(data.courses) || !data.courses.length || data.courses.length > 500) throw new Error('未找到有效课程或课程超过 500 条');
  if (!name.trim()) throw new Error('请填写学期名称');
  if (!isCalendarDate(start) || !isCalendarDate(end) || end < start) throw new Error('学期起止日期无效，请检查日期及先后顺序');
  // School dates/times are China local time, independent of the browser/device time zone.
  const first = new Date(`${start}T00:00:00+08:00`), last = new Date(`${end}T23:59:59+08:00`);
  if (!Number.isFinite(+first) || !Number.isFinite(+last)) throw new Error('学期日期无效');
  const slots = new Map(parseTimeSlots(slotsText).map(slot => [slot.number, slot]));
  const now = new Date().toISOString();
  const semesterId = 'school-import';
  const anchor = new Date(`${start}T00:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() - ((anchor.getUTCDay() || 7) - 1));
  const courses = data.courses.map((c, index) => {
    if (typeof c.name !== 'string' || !c.name.trim() || !Number.isInteger(c.day) || c.day < 1 || c.day > 7 || !Array.isArray(c.weeks) || !c.weeks.length || c.weeks.some(w => !Number.isInteger(w) || w < 1 || w > 60)) throw new Error(`第 ${index + 1} 条课程名称、星期或周次无效`);
    let startTime: string | null | undefined;
    let endTime: string | null | undefined;
    if (c.isCustomTime) {
      startTime = normalizeCourseTime(c.customStartTime);
      endTime = normalizeCourseTime(c.customEndTime);
      if (!startTime || !endTime || endTime <= startTime) throw new Error(`“${c.name}”的自定义时间无效，请填写有效时间且结束晚于开始`);
    } else {
      if (!Number.isInteger(c.startSection) || !Number.isInteger(c.endSection) || c.startSection! < 1 || c.endSection! > 30 || c.endSection! < c.startSection!) throw new Error(`“${c.name}”的节次范围无效，请检查开始和结束节次`);
      const missing = [];
      for (let number = c.startSection!; number <= c.endSection!; number += 1) {
        if (!slots.has(number)) missing.push(number);
      }
      if (missing.length) throw new Error(`“${c.name}”缺少第 ${missing.join('、')} 节作息，请补齐后重试`);
      startTime = slots.get(c.startSection!)?.start;
      endTime = slots.get(c.endSection!)?.end;
    }
    const id = `school-course-${index}`;
    const weeks = [...new Set(c.weeks)].sort((a, b) => a - b);
    const events = weeks.map(w => {
      const date = new Date(anchor); date.setUTCDate(date.getUTCDate() + (w - 1) * 7 + c.day - 1);
      const day = date.toISOString().slice(0, 10);
      return { id: `${id}-${w}`, title: c.name, startTime: new Date(`${day}T${startTime}:00+08:00`).toISOString(), endTime: new Date(`${day}T${endTime}:00+08:00`).toISOString(), location: c.position, courseId: id, isOverride: false };
    }).filter(e => Date.parse(e.startTime) >= +first && Date.parse(e.endTime) <= +last);
    return { id, userId: '', semesterId, name: c.name.trim(), teacher: c.teacher, room: c.position, dayOfWeek: c.day, weeks, startTime, endTime, sourceEntryId: c.sourceId, color: ['#cae393', '#b0a8db', '#a8dadc'][index % 3], createdAt: now, updatedAt: now, events };
  });
  if (!courses.some(c => c.events.length)) throw new Error('所选日期范围已排除全部上课时间，请检查学期日期和课程周次');
  return { format: 'sparkflow-courses', version: 1, exportedAt: now, semesters: [{ id: semesterId, userId: '', name: name.trim(), startDate: first.toISOString(), endDate: last.toISOString(), isActive: false, createdAt: now, updatedAt: now }], courses };
}
