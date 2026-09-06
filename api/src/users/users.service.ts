import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        tasks: { where: { status: { not: 'cancelled' } } },
        inspirations: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });
  }
}
