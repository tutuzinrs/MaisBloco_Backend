import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SearchUsersDto } from './dto/search-users.dto';

export interface SearchUserItem {
  id: number;
  name: string;
  username: string;
  avatar: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    requesterId: number,
    dto: SearchUsersDto,
  ): Promise<{ data: SearchUserItem[]; meta: Record<string, unknown> }> {
    const { q, page = 1, limit = 20, excludeGroupId } = dto;
    const term = q?.trim() ?? '';

    if (!term) {
      return {
        data: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
        },
      };
    }

    const where: Prisma.UserWhereInput = {
      id: { not: requesterId },
      status: 'ACTIVE',
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
      ],
      ...(excludeGroupId
        ? { NOT: { groupMemberships: { some: { groupId: excludeGroupId } } } }
        : {}),
      blockedByUsers: { none: { blockerId: requesterId } },
      blockedUsers: { none: { blockedId: requesterId } },
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { id: true, name: true, username: true, avatar: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    };
  }

  async countFriends(userId: number): Promise<{ count: number }> {
    const count = await this.prisma.friendship.count({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
    });

    return { count };
  }

  async countFavorites(userId: number): Promise<{ count: number }> {
    const count = await this.prisma.favorite.count({
      where: { userId },
    });

    return { count };
  }
}