import { CourseService } from './course.service';

describe('CourseService deletion', () => {
  it('deletes generated occurrences with the exact owned course', async () => {
    const tx = {
      course: {
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'course-short' }),
        delete: jest.fn().mockResolvedValue({ id: 'course-short' }),
      },
      calendarEvent: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };

    await new CourseService(prisma as never).remove('course-short', 'user-1');

    expect(tx.calendarEvent.deleteMany).toHaveBeenCalledWith({
      where: { courseId: 'course-short', userId: 'user-1' },
    });
    expect(tx.course.delete).toHaveBeenCalledWith({
      where: { id: 'course-short', userId: 'user-1' },
    });
  });
});
