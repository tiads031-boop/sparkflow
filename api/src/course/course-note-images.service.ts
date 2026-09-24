import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InspirationMediaService } from '../inspirations/inspiration-media.service';

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

@Injectable()
export class CourseNoteImagesService {
  constructor(private readonly prisma: PrismaService, private readonly media: InspirationMediaService) {}

  async add(noteId: string, userId: string, files: Express.Multer.File[]) {
    const note = await this.prisma.courseNote.findFirst({
      where: { id: noteId, userId },
      select: { id: true, _count: { select: { images: true } } },
    });
    if (!note) throw new NotFoundException('Course task not found');
    if (!files.length || note._count.images + files.length > MAX_IMAGES) throw new BadRequestException('每项课程任务最多添加 4 张图片');
    if (files.some((file) => !IMAGE_TYPES.has(file.mimetype.toLowerCase()) || !file.buffer?.length || file.size > MAX_IMAGE_BYTES)) {
      throw new BadRequestException('仅支持不超过 10 MB 的 JPG、PNG、WebP、GIF 或 HEIC 图片');
    }

    const stored = await this.media.persist(`course-notes/${noteId}`, files);
    try {
      await this.prisma.courseNoteImage.createMany({ data: stored.map((file) => ({
        id: file.id,
        noteId,
        mimeType: file.mimeType,
        originalName: file.originalName,
        storageKey: file.storageKey,
        sizeBytes: file.sizeBytes,
      })) });
      return this.prisma.courseNoteImage.findMany({ where: { noteId }, orderBy: { createdAt: 'asc' }, select: this.publicFields });
    } catch (error) {
      await this.media.removeMany(stored.map((file) => file.storageKey));
      throw error;
    }
  }

  async get(noteId: string, imageId: string, userId: string) {
    const image = await this.prisma.courseNoteImage.findFirst({ where: { id: imageId, noteId, note: { userId } } });
    if (!image) throw new NotFoundException('Course task image not found');
    return image;
  }

  async remove(noteId: string, imageId: string, userId: string) {
    const image = await this.get(noteId, imageId, userId);
    await this.prisma.courseNoteImage.delete({ where: { id: image.id } });
    await this.media.removeMany([image.storageKey]);
    return { deleted: true };
  }

  async keysForNote(noteId: string, userId: string) {
    const note = await this.prisma.courseNote.findFirst({ where: { id: noteId, userId }, select: { images: { select: { storageKey: true } } } });
    return note?.images.map((image) => image.storageKey) || [];
  }

  async keysForCourse(courseId: string, userId: string) {
    const notes = await this.prisma.courseNote.findMany({ where: { courseId, userId }, select: { images: { select: { storageKey: true } } } });
    return notes.flatMap((note) => note.images.map((image) => image.storageKey));
  }

  removeStored(keys: string[]) { return this.media.removeMany(keys); }
  open(key: string) { return this.media.open(key); }

  private readonly publicFields = {
    id: true,
    noteId: true,
    mimeType: true,
    originalName: true,
    sizeBytes: true,
    createdAt: true,
  } as const;
}
