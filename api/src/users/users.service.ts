import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany();
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        tasks: { where: { status: { not: 'cancelled' } } },
        inspirations: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  create(data: { wechatId?: string; nickname?: string }) {
    return this.prisma.user.create({ data });
  }
}
