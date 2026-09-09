import type { ScheduleBackup } from './courseSchedule';
export interface ImportedSchoolCourse {
  name: string; teacher?: string; position?: string; day: number; weeks: number[];
  startSection?: number; endSection?: number; isCustomTime?: boolean; customStartTime?: string; customEndTime?: string;
}
export interface SchoolImportData { courses: ImportedSchoolCourse[]; timeSlots?: { number: number; startTime: string; endTime: string }[]; config?: { semesterStartDate?: string; semesterTotalWeeks?: number }; }

export interface ParsedTimeSlot { number: number; start: string; end: string }

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
    const match = line.trim().match(/^(\d+)\s+(.+?)\s*(?:-|–|—|－|~|～|至)\s*(.+)$/);
    const number = match ? Number(match[1]) : Number.NaN;
    const start = match ? normalizeCourseTime(match[2]) : null;
    const end = match ? normalizeCourseTime(match[3]) : null;
    if (!match || !start || !end || end <= start) throw new Error('节次格式：1 08:00-08:45，每行一节');
    if (number < 1 || number > 30 || slots.has(number)) throw new Error('节次必须为 1–30 且不能重复');
    slots.set(number, { number, start, end });
  }
  return [...slots.values()];
}

export function schoolBackup(data: SchoolImportData, name: string, start: string, end: string, slotsText: string): ScheduleBackup {
  if (!data || !Array.isArray(data.courses) || !data.courses.length || data.courses.length > 500) throw new Error('未找到有效课程或课程超过 500 条');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start || !name.trim()) throw new Error('请填写学期名称和有效的起止日期');
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
    const startTime = c.isCustomTime ? normalizeCourseTime(c.customStartTime) : slots.get(Number(c.startSection))?.start;
    const endTime = c.isCustomTime ? normalizeCourseTime(c.customEndTime) : slots.get(Number(c.endSection))?.end;
    if (!startTime || !endTime || endTime <= startTime) throw new Error(`“${c.name}”缺少有效时间，请补齐第 ${c.startSection} 至 ${c.endSection} 节作息`);
    const id = `school-course-${index}`;
    const weeks = [...new Set(c.weeks)].sort((a, b) => a - b);
    const events = weeks.map(w => {
      const date = new Date(anchor); date.setUTCDate(date.getUTCDate() + (w - 1) * 7 + c.day - 1);
      const day = date.toISOString().slice(0, 10);
      return { id: `${id}-${w}`, title: c.name, startTime: new Date(`${day}T${startTime}:00+08:00`).toISOString(), endTime: new Date(`${day}T${endTime}:00+08:00`).toISOString(), location: c.position, courseId: id, isOverride: false };
    }).filter(e => Date.parse(e.startTime) >= +first && Date.parse(e.endTime) <= +last);
    return { id, userId: '', semesterId, name: c.name.trim(), teacher: c.teacher, room: c.position, dayOfWeek: c.day, weeks, startTime, endTime, color: ['#cae393', '#b0a8db', '#a8dadc'][index % 3], createdAt: now, updatedAt: now, events };
  });
  if (!courses.some(c => c.events.length)) throw new Error('所选学期日期与课程周次没有交集，请检查开学日期');
  return { format: 'sparkflow-courses', version: 1, exportedAt: now, semesters: [{ id: semesterId, userId: '', name: name.trim(), startDate: first.toISOString(), endDate: last.toISOString(), isActive: false, createdAt: now, updatedAt: now }], courses };
}
