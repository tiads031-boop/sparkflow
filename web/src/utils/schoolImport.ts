import type { ScheduleBackup } from './courseSchedule';
export interface ImportedSchoolCourse {
  name: string; teacher?: string; position?: string; day: number; weeks: number[];
  startSection?: number; endSection?: number; isCustomTime?: boolean; customStartTime?: string; customEndTime?: string;
}
export interface SchoolImportData { courses: ImportedSchoolCourse[]; timeSlots?: { number: number; startTime: string; endTime: string }[]; config?: { semesterStartDate?: string; semesterTotalWeeks?: number }; }
export function schoolBackup(data: SchoolImportData, name: string, start: string, end: string, slotsText: string): ScheduleBackup {
  if (!data || !Array.isArray(data.courses) || !data.courses.length || data.courses.length > 500) throw new Error('未找到有效课程或课程超过 500 条');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start || !name.trim()) throw new Error('请填写学期名称和有效的起止日期');
  // School dates/times are China local time, independent of the browser/device time zone.
  const first = new Date(`${start}T00:00:00+08:00`), last = new Date(`${end}T23:59:59+08:00`);
  if (!Number.isFinite(+first) || !Number.isFinite(+last)) throw new Error('学期日期无效');
  const slots = new Map<number, { start: string; end: string }>();
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const line of slotsText.split('\n').filter(l => l.trim())) {
    const match = line.trim().match(/^(\d+)\s+([\d:]+)\s*-\s*([\d:]+)$/);
    if (!match || !time.test(match[2]) || !time.test(match[3]) || match[3] <= match[2]) throw new Error('节次格式：1 08:00-08:45，每行一节');
    const number = Number(match[1]);
    if (number < 1 || number > 30 || slots.has(number)) throw new Error('节次必须为 1–30 且不能重复');
    slots.set(number, { start: match[2], end: match[3] });
  }
  const now = new Date().toISOString();
  const semesterId = 'school-import';
  const anchor = new Date(`${start}T00:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() - ((anchor.getUTCDay() || 7) - 1));
  const courses = data.courses.map((c, index) => {
    if (typeof c.name !== 'string' || !c.name.trim() || !Number.isInteger(c.day) || c.day < 1 || c.day > 7 || !Array.isArray(c.weeks) || !c.weeks.length || c.weeks.some(w => !Number.isInteger(w) || w < 1 || w > 60)) throw new Error(`第 ${index + 1} 条课程名称、星期或周次无效`);
    const startTime = c.isCustomTime ? c.customStartTime : slots.get(Number(c.startSection))?.start;
    const endTime = c.isCustomTime ? c.customEndTime : slots.get(Number(c.endSection))?.end;
    if (!startTime || !endTime || !time.test(startTime) || !time.test(endTime) || endTime <= startTime) throw new Error(`“${c.name}”缺少有效时间，请补齐第 ${c.startSection} 至 ${c.endSection} 节作息`);
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
