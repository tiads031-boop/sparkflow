import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateSemesterDto {
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}

@Injectable()
export class SemesterService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.semester.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { courses: true } } },
    });
  }

  async findOne(id: string, userId: string) {
    const semester = await this.prisma.semester.findFirst({
      where: { id, userId },
      include: { _count: { select: { courses: true } } },
    });
    if (!semester) throw new NotFoundException('Semester not found');
    return semester;
  }

  async create(data: CreateSemesterDto) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate <= startDate) {
      throw new ConflictException('endDate must be later than startDate');
    }

    const weeks = this.calculateWeeks(startDate, endDate);

    if (data.isActive) {
      await this.prisma.semester.updateMany({
        where: { userId: data.userId, isActive: true },
        data: { isActive: false },
      });
    }

    return this.prisma.semester.create({
      data: {
        userId: data.userId,
        name: data.name,
        startDate,
        endDate,
        isActive: data.isActive ?? false,
        weeks,
      },
    });
  }

  async update(id: string, userId: string, data: Record<string, any>) {
    const existing = await this.prisma.semester.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Semester not found');

    const updateData: Record<string, any> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);

    if (data.weeks !== undefined) {
      updateData.weeks = data.weeks;
    } else if (updateData.startDate || updateData.endDate) {
      const start = updateData.startDate ?? existing.startDate;
      const end = updateData.endDate ?? existing.endDate;
      updateData.weeks = this.calculateWeeks(start, end);
    }

    if (data.isActive === true) {
      await this.prisma.semester.updateMany({
        where: { userId, isActive: true, id: { not: id } },
        data: { isActive: false },
      });
      updateData.isActive = true;
    } else if (data.isActive === false) {
      updateData.isActive = false;
    }

    return this.prisma.semester.update({
      where: { id, userId },
      data: updateData,
    });
  }

  async remove(id: string, userId: string) {
    await this.prisma.semester.findFirstOrThrow({
      where: { id, userId },
    });
    return this.prisma.semester.delete({ where: { id, userId } });
  }

  // ==================== 工具方法 ====================

  private calculateWeeks(startDate: Date, endDate: Date): number {
    const diffMs = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
  }
}
