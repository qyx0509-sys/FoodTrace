import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

type CurrentUserProfile = Prisma.UserGetPayload<{
  select: {
    avatarObjectKey: true;
    createdAt: true;
    id: true;
    locale: true;
    nickname: true;
    status: true;
    timezone: true;
    updatedAt: true;
  };
}>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<CurrentUserProfile> {
    const user = await this.prisma.user.findFirst({
      select: {
        avatarObjectKey: true,
        createdAt: true,
        id: true,
        locale: true,
        nickname: true,
        status: true,
        timezone: true,
        updatedAt: true,
      },
      where: { deletedAt: null, id: userId, status: 'ACTIVE' },
    });
    if (user === null) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: '用户不存在' });
    }
    return user;
  }
}
