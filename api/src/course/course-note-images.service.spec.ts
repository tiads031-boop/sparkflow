import { NotFoundException } from '@nestjs/common';
import { CourseNoteImagesService } from './course-note-images.service';

const imageFile = {
  buffer: Buffer.from('image'),
  size: 5,
  mimetype: 'image/png',
  originalname: 'board.png',
} as Express.Multer.File;

describe('CourseNoteImagesService', () => {
  it('does not store an image when the task is not owned by the user', async () => {
    const prisma = { courseNote: { findFirst: jest.fn().mockResolvedValue(null) } };
    const media = { persist: jest.fn() };
    const service = new CourseNoteImagesService(prisma as never, media as never);

    await expect(service.add('another-user-note', 'user-1', [imageFile])).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.courseNote.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'another-user-note', userId: 'user-1' },
    }));
    expect(media.persist).not.toHaveBeenCalled();
  });

  it('removes stored files when image metadata cannot be saved', async () => {
    const prisma = {
      courseNote: { findFirst: jest.fn().mockResolvedValue({ id: 'note-1', _count: { images: 0 } }) },
      courseNoteImage: { createMany: jest.fn().mockRejectedValue(new Error('database unavailable')) },
    };
    const media = {
      persist: jest.fn().mockResolvedValue([{
        id: 'image-1',
        mimeType: 'image/png',
        originalName: 'board.png',
        storageKey: 'course-notes/note-1/image-1.png',
        sizeBytes: 5,
      }]),
      removeMany: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CourseNoteImagesService(prisma as never, media as never);

    await expect(service.add('note-1', 'user-1', [imageFile])).rejects.toThrow('database unavailable');
    expect(media.removeMany).toHaveBeenCalledWith(['course-notes/note-1/image-1.png']);
  });
});
