import { useEffect, useRef } from 'react';
import type { Course, Semester } from '../../types';
import { courseOccursOnDate, dedupeCoursesByOccurrence, getMonday, getSemesterWeekNumber, localDateKey } from './planProjection';
import { layoutTimetableIntervals } from './timetableLayout';

const periods = [
  ['1', '08:00', '08:50'],
  ['2', '09:00', '09:50'],
  ['3', '10:10', '11:00'],
  ['4', '11:10', '12:00'],
  ['5', '13:30', '14:20'],
  ['6', '14:30', '15:20'],
  ['7', '15:40', '16:30'],
  ['8', '16:40', '17:30'],
  ['9', '18:30', '19:20'],
  ['10', '19:30', '20:20'],
] as const;

const ROW_HEIGHT = 76;

function minutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function coursePeriodRange(course: Course) {
  if (!course.startTime || !course.endTime) return null;
  const start = minutes(course.startTime);
  const end = minutes(course.endTime);
  const first = periods.findIndex(([, periodStart, periodEnd]) => start < minutes(periodEnd) && end > minutes(periodStart));
  const last = [...periods]
    .map((period, index) => ({ period, index }))
    .reverse()
    .find(({ period: [, periodStart, periodEnd] }) => start < minutes(periodEnd) && end > minutes(periodStart))?.index ?? -1;
  if (first < 0 || last < first) return null;
  return { first, last };
}

function cardBackground(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}30` : '#eef2ff';
}

interface TimetablePlanViewProps {
  selectedDate: Date;
  courses: Course[];
  semester?: Semester | null;
  onCourseClick?: (courseId: string) => void;
}

export default function TimetablePlanView({ selectedDate, courses, semester, onCourseClick }: TimetablePlanViewProps) {
  const monday = getMonday(selectedDate);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
  const week = getSemesterWeekNumber(selectedDate, semester);
  const selectedKey = localDateKey(selectedDate);
  const selectedWeekday = selectedDate.getDay() || 7;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const semesterCourses = dedupeCoursesByOccurrence(
    semester
      ? courses.filter((course) => !course.semesterId || course.semesterId === semester.id)
      : courses,
  );

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const selectedIndex = selectedWeekday - 1;
    const timeColumnWidth = 56;
    const dayWidth = (scroller.scrollWidth - timeColumnWidth) / 7;
    const targetCenter = timeColumnWidth + (selectedIndex + 0.5) * dayWidth;
    const maxLeft = scroller.scrollWidth - scroller.clientWidth;
    scroller.scrollTo({ left: Math.max(0, Math.min(maxLeft, targetCenter - scroller.clientWidth / 2)) });
  }, [selectedKey, selectedWeekday]);

  return (
    <section className="overflow-hidden rounded-[1.75rem] bg-[var(--sf-surface)] shadow-sm">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sf-text-tertiary)]">Timetable</p>
          <h2 className="text-sm font-black text-[var(--sf-text-primary)]">{week ? `第 ${week} 周课程表` : '课程时间表'}</h2>
        </div>
        <span className="text-[9px] text-[var(--sf-text-tertiary)]">淡色 = 非本周</span>
      </div>

      <div ref={scrollerRef} className="overflow-x-auto overscroll-x-contain">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[56px_repeat(7,minmax(88px,1fr))] border-b border-black/5 px-1.5 py-2">
            <div className="sticky left-0 z-20 bg-[var(--sf-surface)]" />
            {days.map((day) => (
              <div key={day.toISOString()} className="text-center">
                <p className="text-[9px] text-[var(--sf-text-tertiary)]">{'日一二三四五六'[day.getDay()]}</p>
                <p className="text-xs font-black text-[var(--sf-text-primary)]">{day.getDate()}</p>
              </div>
            ))}
          </div>

          <div className="max-h-[62svh] overflow-y-auto">
            <div className="grid grid-cols-[56px_repeat(7,minmax(88px,1fr))] px-1.5">
              <div className="sticky left-0 z-20 bg-[var(--sf-surface)]">
                {periods.map(([period, start, end]) => (
                  <div key={period} className="flex flex-col justify-center border-b border-black/5" style={{ height: ROW_HEIGHT }}>
                    <strong className="text-lg leading-none text-[var(--sf-text-primary)]">{period}</strong>
                    <span className="mt-1 text-[8px] leading-3 text-[var(--sf-text-tertiary)]">{start}<br />{end}</span>
                  </div>
                ))}
              </div>

              {days.map((day) => {
                const weekday = day.getDay() || 7;
                const dayCourses = semesterCourses.filter(
                  (course) => course.dayOfWeek === weekday && course.startTime && course.endTime,
                );
                const courseLayouts = layoutTimetableIntervals(dayCourses.flatMap((course) => {
                  const range = coursePeriodRange(course);
                  return range ? [{ course, ...range }] : [];
                }));

                return (
                  <div key={day.toISOString()} className="relative border-l border-black/[0.05]" style={{ height: periods.length * ROW_HEIGHT }}>
                    {periods.map(([period], index) => (
                      <span
                        key={period}
                        className="absolute left-0 right-0 border-b border-black/[0.05]"
                        style={{ top: (index + 1) * ROW_HEIGHT }}
                      />
                    ))}

                    {courseLayouts.map(({ course, first, last, lane, laneCount }) => {
                      const active = courseOccursOnDate(course, day, semester);
                      const top = first * ROW_HEIGHT + 3;
                      const height = (last - first + 1) * ROW_HEIGHT - 6;
                      const titleMaxHeight = height >= ROW_HEIGHT * 1.5 ? 55 : 33;
                      const laneWidth = 100 / laneCount;
                      const compact = laneCount > 1;

                      return (
                        <button
                          key={course.id}
                          type="button"
                          onClick={() => onCourseClick?.(course.id)}
                          className={`absolute overflow-hidden rounded-lg border-l-2 py-1.5 text-left shadow-sm ${compact ? 'px-1' : 'px-1.5'} ${active ? '' : 'opacity-35'}`}
                          style={{
                            top,
                            height,
                            left: `calc(${lane * laneWidth}% + 2px)`,
                            width: `calc(${laneWidth}% - 4px)`,
                            borderLeftColor: course.color,
                            backgroundColor: cardBackground(course.color),
                          }}
                          title={course.name}
                        >
                          <span
                            className={`block overflow-hidden [overflow-wrap:anywhere] font-black text-[#242424] ${compact ? 'text-[8px] leading-[10px]' : 'text-[9px] leading-[11px]'}`}
                            style={{ maxHeight: titleMaxHeight }}
                          >
                            {course.name}
                          </span>
                          {!compact && height >= 64 && (course.room || course.location) && (
                            <span className="mt-1 block truncate text-[8px] leading-[10px] text-gray-500">
                              @{course.room || course.location}
                            </span>
                          )}
                          {!active && (
                            <span className="absolute bottom-1 left-1.5 rounded bg-white/70 px-1 text-[7px] font-bold text-gray-500">
                              非本周
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
