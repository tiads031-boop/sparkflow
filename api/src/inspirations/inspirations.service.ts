import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InspirationsService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, status?: string) {
    return this.prisma.inspiration.findMany({
      where: { userId, ...(status && { status }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string, userId: string) {
    return this.prisma.inspiration.findFirst({ where: { id, userId } });
  }

  create(data: {
    userId: string;
    sourceUrl: string;
    sourceType?: string;
    title?: string;
    description?: string;
    contentText?: string;
    coverImage?: string;
    author?: string;
    tags?: string[];
  }) {
    return this.prisma.inspiration.create({ data });
  }

  updateStatus(id: string, userId: string, status: string) {
    return this.prisma.inspiration.update({
      where: { id, userId },
      data: { status },
    });
  }
}
