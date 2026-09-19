import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudyService } from './study.service';

describe('StudyService M1', () => {
  it('creates a user-owned folder with existing course and task links', async () => {
    interface CreateArgs {
      data: {
        userId: string;
        name: string;
        description: string | null;
        icon: string;
        color: string;
        courses: { create: Array<{ courseId: string }> };
        tasks: { create: Array<{ taskId: string }> };
      };
    }
    const create = jest.fn(({ data }: CreateArgs) => ({
      id: 'folder-1',
      ...data,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      courses: data.courses.create.map(({ courseId }) => ({
        course: { id: courseId },
      })),
      tasks: data.tasks.create.map(({ taskId }) => ({
        task: { id: taskId },
      })),
    }));
    const prisma = {
      course: { findMany: jest.fn().mockResolvedValue([{ id: 'course-1' }]) },
      task: { findMany: jest.fn().mockResolvedValue([{ id: 'task-1' }]) },
      studyFolder: { create },
    };
    const service = new StudyService(prisma as never);

    const result = await service.create('user-1', {
      name: ' 考研英语 ',
      courseIds: ['course-1'],
      taskIds: ['task-1'],
    });

    const createArgs = create.mock.calls[0][0];
    expect(createArgs.data.userId).toBe('user-1');
    expect(createArgs.data.name).toBe('考研英语');
    expect(result.courses).toEqual([{ id: 'course-1' }]);
    expect(result.tasks).toEqual([{ id: 'task-1' }]);
  });

  it('rejects links to another user course before creating the folder', async () => {
    const prisma = {
      course: { findMany: jest.fn().mockResolvedValue([]) },
      task: { findMany: jest.fn().mockResolvedValue([]) },
      studyFolder: { create: jest.fn() },
    };
    const service = new StudyService(prisma as never);

    await expect(
      service.create('user-1', {
        name: '越权关联',
        courseIds: ['foreign-course'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.studyFolder.create).not.toHaveBeenCalled();
  });

  it('does not archive a folder owned by another user', async () => {
    const prisma = {
      studyFolder: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const service = new StudyService(prisma as never);

    await expect(
      service.setStatus('folder-1', 'user-2', 'archived'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studyFolder.update).not.toHaveBeenCalled();
  });
});
