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

  findOne(id: string) {
    return this.prisma.inspiration.findUnique({ where: { id } });
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

  updateStatus(id: string, status: string) {
    return this.prisma.inspiration.update({
      where: { id },
      data: { status },
    });
  }
}
