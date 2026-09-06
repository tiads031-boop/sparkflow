import type { Course, CalendarEvent, Semester } from '../types';

export interface ScheduleBackup {
  format: 'sparkflow-courses';
  version: 1;
  exportedAt: string;
  semesters: Semester[];
  courses: (Course & { events: (CalendarEvent & { location?: string })[] })[];
}
export type Occurrence = CalendarEvent & { course: Course; location?: string };
export function occurrences(backup: ScheduleBackup, semesterId?: string | null): Occurrence[] {
  return backup.courses.filter(c => !semesterId || c.semesterId === semesterId)
    .flatMap(course => course.events.map(e => ({ ...e, course })))
    .filter(e => Number.isFinite(Date.parse(e.startTime)) && Date.parse(e.endTime) > Date.parse(e.startTime))
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}
export function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const escapeIcs = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const stamp = (s: string) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function fold(line: string) {
  const encoder = new TextEncoder();
  let result = '', width = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (width + size > 75) { result += '\r\n '; width = 1; }
    result += ch; width += size;
  }
  return result;
}
export function scheduleIcs(backup: ScheduleBackup) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SparkFlow//Courses//ZH', 'CALSCALE:GREGORIAN'];
  for (const e of occurrences(backup)) {
    lines.push('BEGIN:VEVENT', `UID:${escapeIcs(e.id)}@sparkflow`, `DTSTAMP:${stamp(backup.exportedAt)}`,
      `DTSTART:${stamp(e.startTime)}`, `DTEND:${stamp(e.endTime)}`, `SUMMARY:${escapeIcs(e.title)}`,
      `LOCATION:${escapeIcs(e.location || e.course.room || e.course.location || '')}`,
      `DESCRIPTION:${escapeIcs(e.course.teacher ? `教师：${e.course.teacher}` : '')}`, 'END:VEVENT');
  }
  return [...lines, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
export function downloadSchedule(text: string, extension: 'json' | 'ics') {
  const url = URL.createObjectURL(new Blob([text], { type: extension === 'ics' ? 'text/calendar;charset=utf-8' : 'application/json;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `SparkFlow-课表-${localDay(new Date())}.${extension}`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
