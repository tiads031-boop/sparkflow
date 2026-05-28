/**
 * 课程表 ICS 导入脚本
 *
 * 用法: node scripts/import-courses.js
 *
 * 流程：
 * 1. 解析 ICS 文件 → 提取所有 VEVENT
 * 2. 按课程名称分组
 * 3. 创建 Course 记录（icsUid 幂等）
 * 4. 生成 CalendarEvent 实例
 *
 * 依赖: node-ical（ICS 解析）
 * 配置: scripts/course-import-config.json
 */

const ical = require('node-ical');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

// ==================== 加载配置 ====================

const configPath = path.resolve(__dirname, 'course-import-config.json');
if (!fs.existsSync(configPath)) {
  console.error('❌ 配置文件不存在:', configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

if (!fs.existsSync(config.icsPath)) {
  console.error('❌ ICS 文件不存在:', config.icsPath);
  process.exit(1);
}

// ==================== 工具函数 ====================

function pad(n) {
  return n.toString().padStart(2, '0');
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 解析学期起始日
 * 返回该日期所在的周一的 00:00:00
 */
function getSemesterMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay() || 7;
  if (dow !== 1) {
    d.setDate(d.getDate() - (dow - 1));
  }
  return d;
}

/**
 * 计算给定日期属于学期第几周（从 1 开始）
 */
function getWeekNumber(date, semesterMonday) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diffMs = d.getTime() - semesterMonday.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

/**
 * 获取日期是周几（1=Mon..7=Sun）
 */
function getDayOfWeek(date) {
  const dow = date.getDay();
  return dow === 0 ? 7 : dow;
}

// ==================== 主流程 ====================

async function main() {
  const prisma = new PrismaClient();
  const userId = config.userId || 'default';
  const semesterStart = config.semesterStart || '2025-03-03';
  const semesterMonday = getSemesterMonday(semesterStart);

  console.log('📅 学期起始（周一）:', semesterMonday.toISOString().slice(0, 10));
  console.log('📂 ICS 文件:', config.icsPath);
  console.log('👤 用户 ID:', userId);

  // 1. 解析 ICS
  console.log('\n🔍 正在解析 ICS...');
  let events;
  try {
    events = await ical.async.parseFile(config.icsPath);
  } catch (err) {
    console.error('❌ ICS 解析失败:', err.message);
    process.exit(1);
  }

  // 2. 提取 VEVENT，过滤排除课程
  const excludeSet = new Set(config.filters?.excludeCourses || []);
  const courseMap = new Map(); // courseName → { instances: [], location, uid }

  for (const [key, ev] of Object.entries(events)) {
    if (ev.type !== 'VEVENT') continue;

    const summary = ev.summary?.trim();
    if (!summary || excludeSet.has(summary)) continue;

    // 跳过学期范围外的实例
    if (ev.start < semesterMonday) continue;
    const semesterEnd = new Date(config.semesterEnd);
    if (ev.start > semesterEnd) continue;

    if (!courseMap.has(summary)) {
      courseMap.set(summary, {
        instances: [],
        location: '',
        uid: ev.uid || '',
      });
    }

    const course = courseMap.get(summary);
    course.instances.push({
      start: ev.start,
      end: ev.end,
    });

    // 收集地点（取第一个非空）
    if (!course.location && ev.location) {
      course.location = ev.location;
    }
  }

  console.log(`📊 找到 ${courseMap.size} 门课程`);

  // 3. 创建/更新 Course + CalendarEvent
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let eventCount = 0;

  for (const [courseName, data] of courseMap.entries()) {
    const instances = data.instances;
    if (instances.length === 0) continue;

    // 推断课程规则
    const first = instances[0];
    const startTime = formatTime(first.start);
    const endTime = formatTime(first.end);
    const dayOfWeek = getDayOfWeek(first.start);

    // 收集周次
    const weeks = instances
      .map((inst) => getWeekNumber(inst.start, semesterMonday))
      .filter((w) => w > 0)
      .sort((a, b) => a - b);

    // 去重周次（同一周同课程可能出现多次，如实验+理论）
    const uniqueWeeks = [...new Set(weeks)];

    // 解析教室/教师（从 location 字段提取）
    // 常见格式："教3-201" 或 "张教授/教3-201"
    let teacher = '';
    let room = data.location || '';

    // 颜色
    const color = config.colorMap?.[courseName] || config.defaultColor || '#b0a8db';

    // 检查是否已存在（通过名称匹配）
    const existing = await prisma.course.findFirst({
      where: { userId, name: courseName },
    });

    let course;
    if (existing) {
      // 更新已有课程
      course = await prisma.course.update({
        where: { id: existing.id },
        data: {
          dayOfWeek,
          startTime,
          endTime,
          weeks: uniqueWeeks,
          room,
          location: data.location || undefined,
          color,
          icsUid: data.uid || undefined,
        },
      });

      // 删除旧事件后重新生成
      await prisma.calendarEvent.deleteMany({
        where: { courseId: course.id, isOverride: false },
      });
      updatedCount++;
    } else {
      // 创建新课程
      course = await prisma.course.create({
        data: {
          userId,
          name: courseName,
          teacher: teacher || null,
          room,
          location: data.location || null,
          color,
          dayOfWeek,
          startTime,
          endTime,
          weeks: uniqueWeeks,
          icsUid: data.uid || null,
        },
      });
      createdCount++;
    }

    // 批量创建 CalendarEvent
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

    // 分批创建，避免过大的单次插入
    const BATCH_SIZE = 100;
    for (let i = 0; i < eventData.length; i += BATCH_SIZE) {
      const batch = eventData.slice(i, i + BATCH_SIZE);
      await prisma.calendarEvent.createMany({ data: batch });
    }

    eventCount += eventData.length;
    console.log(`  ${courseName}: ${uniqueWeeks.length}周 × ${instances.length}实例, weeks=${uniqueWeeks.join(',')}`);
  }

  // 4. 输出统计
  console.log('\n✅ 导入完成');
  console.log(`  新建课程: ${createdCount}`);
  console.log(`  更新课程: ${updatedCount}`);
  console.log(`  跳过课程: ${skippedCount}`);
  console.log(`  日历事件: ${eventCount}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ 导入失败:', err);
  process.exit(1);
});
