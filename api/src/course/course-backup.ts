import { BadRequestException } from '@nestjs/common';

type Row = Record<string, unknown>;
const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (): never => { throw new BadRequestException('课表备份格式无效或数据超出限制'); };
function str(v: unknown, max = 500): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) return fail();
  return v;
}
function optional(v: unknown) { return v == null || v === '' ? undefined : str(v); }
function date(v: unknown): string {
  const s = str(v);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s) || !Number.isFinite(Date.parse(s))) return fail();
  return s;
}
function rows(v: unknown, max: number): Row[] {
  if (!Array.isArray(v) || v.length > max || !v.every(record)) return fail();
  return v;
}

// Whitelist only timetable data. Never restore ownership, tasks or external sync IDs.
export function parseCourseBackup(value: unknown) {
  if (!record(value) || value.format !== 'sparkflow-courses' || value.version !== 1) return fail();
  const semesters = rows(value.semesters, 100).map(s => {
    const startDate = date(s.startDate), endDate = date(s.endDate);
    if (Date.parse(endDate) < Date.parse(startDate)) return fail();
    return { id: str(s.id), name: str(s.name), startDate, endDate };
  });
  const semesterIds = new Set(semesters.map(s => s.id));
  if (semesterIds.size !== semesters.length) return fail();
  let eventCount = 0;
  const courses = rows(value.courses, 500).map(c => {
    const semesterId = optional(c.semesterId);
    if (semesterId && !semesterIds.has(semesterId)) return fail();
    const weeks = c.weeks == null ? [] : c.weeks;
    if (!Array.isArray(weeks) || weeks.length > 60 || !weeks.every(w => Number.isInteger(w) && w >= 1 && w <= 60)) return fail();
    const dayOfWeek = c.dayOfWeek == null ? undefined : Number(c.dayOfWeek);
    if (dayOfWeek !== undefined && (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7)) return fail();
    const startTime = optional(c.startTime), endTime = optional(c.endTime);
    for (const t of [startTime, endTime]) if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return fail();
    if (startTime && endTime && endTime <= startTime) return fail();
    const color = optional(c.color) || '#b0a8db';
    if (!/^#[0-9a-f]{6}$/i.test(color)) return fail();
    const events = rows(c.events, 1000).map(e => {
      const startTime = date(e.startTime), endTime = date(e.endTime);
      if (Date.parse(endTime) <= Date.parse(startTime)) return fail();
      return { title: str(e.title), startTime, endTime, location: optional(e.location), isOverride: e.isOverride === true };
    });
    eventCount += events.length;
    if (eventCount > 10000) return fail();
    return { name: str(c.name), teacher: optional(c.teacher), room: optional(c.room), location: optional(c.location), color, dayOfWeek, startTime, endTime, weeks: weeks as number[], semesterId, events };
  });
  return { semesters, courses };
}
