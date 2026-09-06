import { CourseService } from './course.service';
import { PrismaService } from '../prisma/prisma.service';

describe('course schedule integration with existing event model', () => {
  it('maps adjusted rooms to CalendarEvent.location', async () => {
    const prisma = { calendarEvent: { findFirst: jest.fn().mockResolvedValue({ id: 'e' }), update: jest.fn().mockResolvedValue({}) } };
    const service = new CourseService(prisma as unknown as PrismaService);
    await service.adjustEvent('e', 'u', { room: 'B202' });
    expect(prisma.calendarEvent.update).toHaveBeenCalledWith({ where: { id: 'e', userId: 'u' }, data: { location: 'B202', isOverride: true } });
  });
  it('does not create reminder source events outside semester boundaries', async () => {
    const semester = { startDate: new Date(2026, 8, 9), endDate: new Date(2026, 8, 20) };
    const course = { id: 'c', userId: 'u', semesterId: 's', name: '数学', dayOfWeek: 1, startTime: '08:00', endTime: '09:40', weeks: [1, 2, 3], room: 'A101', color: '#cae393' };
    const prisma = {
      course: { create: jest.fn().mockResolvedValue(course), findFirst: jest.fn().mockResolvedValue(course) },
      semester: { findUnique: jest.fn().mockResolvedValue(semester), findFirst: jest.fn().mockResolvedValue(semester) },
      calendarEvent: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    await new CourseService(prisma as unknown as PrismaService).create(course);
    const data = prisma.calendarEvent.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0].startTime).toEqual(new Date(2026, 8, 14, 8));
    expect(data[0].location).toBe('A101');
  });
});
