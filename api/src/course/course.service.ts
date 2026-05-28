import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface CourseCreateData {
  userId: string;
  name: string;
  teacher?: string;
  room?: string;
  color?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  weeks?: number[];
  location?: string;
  icsUid?: string;
}

interface CourseUpdateData {
  name?: string;
  teacher?: string;
  room?: string;
  color?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  weeks?: number[];
  location?: string;
  regenerate?: boolean; // 是否触发换课：重新生成 CalendarEvent
}

interface NoteData {
  userId: string;
  courseId: string;
  body: string;
  pinned?: boolean;
}

@Injectable()
export class CourseService {
  constructor(private prisma: PrismaService) {}

  // ==================== Course CRUD ====================

  async findAll(userId: string) {
    return this.prisma.course.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { events: true, tasks: true, notes: true } } },
    });
  }

  async findOne(id: string, userId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, userId },
      include: {
        events: { orderBy: { startTime: 'asc' } },
        tasks: { orderBy: { createdAt: 'desc' } },
        notes: { orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }] },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async create(data: CourseCreateData) {
    const course = await this.prisma.course.create({
      data: {
        userId: data.userId,
        name: data.name,
        teacher: data.teacher,
        room: data.room,
        color: data.color ?? '#b0a8db',
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        weeks: data.weeks ?? [],
        location: data.location,
        icsUid: data.icsUid,
      },
    });

    // 如果有完整规则，自动生成 CalendarEvent
    if (data.dayOfWeek && data.startTime && data.endTime && data.weeks?.length) {
      await this.generateEvents(course);
    }

    return this.findOne(course.id, data.userId);
  }

  async update(id: string, userId: string, data: CourseUpdateData) {
    const existing = await this.prisma.course.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Course not found');

    const { regenerate, ...courseData } = data;

    const updated = await this.prisma.course.update({
      where: { id },
      data: courseData,
    });

    // 换课：重新生成 CalendarEvent（跳过 isOverride 的实例）
    if (regenerate || this.hasScheduleChange(data, existing)) {
      await this.regenerateEvents(updated);
    }

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    await this.prisma.course.findFirstOrThrow({ where: { id, userId } });
    return this.prisma.course.delete({ where: { id } });
  }

  // ==================== 课程实例 (CalendarEvent) ====================

  async findEvents(courseId: string, userId: string) {
    await this.prisma.course.findFirstOrThrow({ where: { id: courseId, userId } });
    return this.prisma.calendarEvent.findMany({
      where: { courseId },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * 调课：修改单个实例的时间/教室，标记 isOverride
   */
  async adjustEvent(eventId: string, userId: string, data: {
    startTime?: string;
    endTime?: string;
    room?: string;
    title?: string;
  }) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, userId },
    });
    if (!event) throw new NotFoundException('CalendarEvent not found');

    const updateData: any = { ...data, isOverride: true };
    if (data.startTime) updateData.startTime = new Date(data.startTime);
    if (data.endTime) updateData.endTime = new Date(data.endTime);

    return this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: updateData,
    });
  }

  // ==================== 课程笔记 ====================

  async findNotes(courseId: string, userId: string) {
    return this.prisma.courseNote.findMany({
      where: { courseId, userId },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createNote(data: NoteData) {
    return this.prisma.courseNote.create({ data });
  }

  async updateNote(id: string, userId: string, data: { body?: string; pinned?: boolean }) {
    const note = await this.prisma.courseNote.findFirst({ where: { id, userId } });
    if (!note) throw new NotFoundException('CourseNote not found');
    return this.prisma.courseNote.update({ where: { id }, data });
  }

  async deleteNote(id: string, userId: string) {
    const note = await this.prisma.courseNote.findFirst({ where: { id, userId } });
    if (!note) throw new NotFoundException('CourseNote not found');
    return this.prisma.courseNote.delete({ where: { id } });
  }

  // ==================== 内部方法 ====================

  /**
   * 根据 Course 规则模板生成所有 CalendarEvent 实例
   */
  private async generateEvents(course: any) {
    if (!course.dayOfWeek || !course.startTime || !course.endTime) return;

    const semesterStart = this.getSemesterStart();
    const instances = this.expandSchedule(
      semesterStart,
      course.dayOfWeek,
      course.startTime,
      course.endTime,
      course.weeks,
      course.room,
    );

    // 批量创建
    await this.prisma.calendarEvent.createMany({
      data: instances.map((inst) => ({
        userId: course.userId,
        courseId: course.id,
        title: course.name,
        eventType: 'course',
        startTime: inst.start,
        endTime: inst.end,
        color: course.color,
        isOverride: false,
      })),
    });
  }

  /**
   * 换课：删除非覆盖实例，重新生成
   */
  private async regenerateEvents(course: any) {
    // 删除非覆盖的旧事件
    await this.prisma.calendarEvent.deleteMany({
      where: { courseId: course.id, isOverride: false },
    });

    // 重新生成
    await this.generateEvents(course);
  }

  /**
   * 展开学期范围内的课程实例
   */
  private expandSchedule(
    semesterStart: Date,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    weeks: number[],
    room?: string,
  ) {
    const instances: { start: Date; end: Date }[] = [];
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);

    // 从学期起始日找到第一个匹配的 weekday
    const start = new Date(semesterStart);
    // 调整到学期开始的周一
    const monday = new Date(start);
    const startDow = start.getDay() || 7;
    if (startDow !== 1) {
      monday.setDate(monday.getDate() - (startDow - 1));
    }

    for (const week of weeks) {
      const date = new Date(monday);
      date.setDate(date.getDate() + (week - 1) * 7 + (dayOfWeek - 1));
      date.setHours(sh, sm, 0, 0);
      const end = new Date(date);
      end.setHours(eh, em, 0, 0);

      instances.push({ start: new Date(date), end: new Date(end) });
    }

    return instances;
  }

  /**
   * 检测更新是否涉及排课规则变化
   */
  private hasScheduleChange(data: CourseUpdateData, existing: any): boolean {
    return !!(
      (data.dayOfWeek !== undefined && data.dayOfWeek !== existing.dayOfWeek) ||
      (data.startTime !== undefined && data.startTime !== existing.startTime) ||
      (data.endTime !== undefined && data.endTime !== existing.endTime) ||
      (data.weeks !== undefined && JSON.stringify(data.weeks) !== JSON.stringify(existing.weeks)) ||
      (data.room !== undefined && data.room !== existing.room)
    );
  }

  /**
   * 获取学期起始日（默认上周一，可后续改为配置驱动）
   */
  private getSemesterStart(): Date {
    const now = new Date();
    const dow = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - (dow - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  // ==================== ICS 文件导入 ====================

  async importFromIcs(
    fileBuffer: Buffer,
    userId: string,
    options?: {
      semesterStart?: string;
      semesterEnd?: string;
      excludeCourses?: string[];
      colorMap?: Record<string, string>;
    },
  ) {
    // 将 buffer 写入临时文件（node-ical 只支持文件路径）
    const tmpDir = os.tmpdir();
    const tmpPath = path.join(tmpDir, `course-import-${Date.now()}.ics`);
    fs.writeFileSync(tmpPath, fileBuffer);

    let ical: any;
    try {
      ical = require('node-ical');
    } catch {
      try {
        fs.unlinkSync(tmpPath);
      } catch { /* ignore */ }
      throw new Error('node-ical 未安装，无法解析 ICS 文件');
    }

    let events: any;
    try {
      events = await ical.async.parseFile(tmpPath);
    } catch (err: any) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      throw new Error(`ICS 解析失败: ${err.message}`);
    }

    // 清理临时文件
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }

    const excludeSet = new Set(options?.excludeCourses || []);

    // ── 展开 RRULE，收集所有实际课程实例 ──
    const rawInstances: { summary: string; start: Date; end: Date; location: string; uid: string }[] = [];

    for (const [, ev] of Object.entries(events)) {
      if ((ev as any).type !== 'VEVENT') continue;
      const summary = (ev as any).summary?.trim();
      if (!summary || excludeSet.has(summary)) continue;

      const location = (ev as any).location || '';
      const uid = (ev as any).uid || '';
      const duration = (ev as any).end.getTime() - (ev as any).start.getTime();

      if ((ev as any).rrule) {
        // 展开 RRULE：为每个重复实例生成 start/end
        const allStarts: Date[] = (ev as any).rrule.all();
        for (const start of allStarts) {
          rawInstances.push({
            summary,
            start,
            end: new Date(start.getTime() + duration),
            location,
            uid,
          });
        }
      } else {
        rawInstances.push({
          summary,
          start: (ev as any).start,
          end: (ev as any).end,
          location,
          uid,
        });
      }
    }

    // ── 自动推断学期日期范围（未提供时从实例中取最早/最晚日期） ──
    let semesterEnd: Date | null = options?.semesterEnd ? new Date(options.semesterEnd) : null;
    let semesterStart: string = options?.semesterStart || (() => {
      // 从实例中推断最早日期作为学期开始
      if (rawInstances.length === 0) return '2025-03-03';
      let earliest = rawInstances[0].start;
      for (const inst of rawInstances) {
        if (inst.start < earliest) earliest = inst.start;
      }
      return earliest.toISOString().split('T')[0];
    })();

    if (!semesterEnd) {
      // 从实例中推断最晚日期 + 1 周缓冲作为学期结束
      let latest = rawInstances[0]?.end ?? new Date();
      for (const inst of rawInstances) {
        if (inst.end > latest) latest = inst.end;
      }
      semesterEnd = new Date(latest);
      semesterEnd.setDate(semesterEnd.getDate() + 7);
    }

    const semesterMonday = this.getMonday(new Date(semesterStart + 'T00:00:00'));

    // ── 按课程名分组（应用日期范围过滤） ──
    const courseMap = new Map<string, { instances: { start: Date; end: Date }[]; location: string; uid: string }>();

    for (const inst of rawInstances) {
      if (inst.start < semesterMonday || inst.start > semesterEnd) continue;

      if (!courseMap.has(inst.summary)) {
        courseMap.set(inst.summary, { instances: [], location: '', uid: inst.uid });
      }
      const course = courseMap.get(inst.summary)!;
      course.instances.push({ start: inst.start, end: inst.end });
      if (!course.location && inst.location) {
        course.location = inst.location;
      }
      if (!course.uid && inst.uid) {
        course.uid = inst.uid;
      }
    }

    const results: { created: string[]; updated: string[]; eventCount: number } = {
      created: [],
      updated: [],
      eventCount: 0,
    };

    for (const [courseName, data] of courseMap.entries()) {
      const instances = data.instances;
      if (instances.length === 0) continue;

      const first = instances[0];
      const startTime = this.formatTime(first.start);
      const endTime = this.formatTime(first.end);
      const dayOfWeek = this.getDayOfWeek(first.start);

      const weeks = instances
        .map((inst) => this.getWeekNumber(inst.start, semesterMonday))
        .filter((w) => w > 0)
        .sort((a, b) => a - b);
      const uniqueWeeks = [...new Set(weeks)];

      const color = options?.colorMap?.[courseName] || '#b0a8db';

      // 幂等：通过名称匹配已有课程
      const existing = await this.prisma.course.findFirst({
        where: { userId, name: courseName },
      });

      let course: any;
      if (existing) {
        course = await this.prisma.course.update({
          where: { id: existing.id },
          data: {
            dayOfWeek, startTime, endTime,
            weeks: uniqueWeeks,
            room: data.location || undefined,
            location: data.location || undefined,
            color,
            icsUid: data.uid || undefined,
          },
        });
        await this.prisma.calendarEvent.deleteMany({
          where: { courseId: course.id, isOverride: false },
        });
        results.updated.push(courseName);
      } else {
        course = await this.prisma.course.create({
          data: {
            userId, name: courseName,
            room: data.location || null,
            location: data.location || null,
            color, dayOfWeek, startTime, endTime,
            weeks: uniqueWeeks,
            icsUid: data.uid || null,
          },
        });
        results.created.push(courseName);
      }

      // 批量创建 CalendarEvent
      const BATCH_SIZE = 100;
      const eventData = instances.map((inst) => ({
        userId,
        courseId: course.id,
        title: courseName,
        eventType: 'course',
        startTime: inst.start,
        endTime: inst.end,
        color,
        isOverride: false,
      }));

      for (let i = 0; i < eventData.length; i += BATCH_SIZE) {
        const batch = eventData.slice(i, i + BATCH_SIZE);
        await this.prisma.calendarEvent.createMany({ data: batch });
      }
      results.eventCount += eventData.length;
    }

    return results;
  }

  // ==================== ICS 导入工具函数 ====================

  /** 将 UTC Date 转为 CST（北京时间）后再格式化时间字符串 */
  private formatTime(date: Date): string {
    // node-ical 返回 UTC 时间，课程是 CST 时区 (UTC+8)
    const localH = (date.getUTCHours() + 8) % 24;
    const localM = date.getUTCMinutes();
    return `${localH.toString().padStart(2, '0')}:${localM.toString().padStart(2, '0')}`;
  }

  private getMonday(d: Date): Date {
    const m = new Date(d);
    const dow = m.getDay() || 7;
    if (dow !== 1) m.setDate(m.getDate() - (dow - 1));
    m.setHours(0, 0, 0, 0);
    return m;
  }

  private getWeekNumber(date: Date, semesterMonday: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diffMs = d.getTime() - semesterMonday.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  }

  /** 返回 CST（中国时间）下的星期几（1=周一，7=周日） */
  private getDayOfWeek(date: Date): number {
    // node-ical 返回 UTC 时间，+8h 偏移得到 CST 对应的星期
    const localDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const dow = localDate.getUTCDay();
    return dow === 0 ? 7 : dow;
  }
}
