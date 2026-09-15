import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SearchUsersDto } from './dto/search-users.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

export interface SearchUserItem {
  id: number;
  name: string;
  username: string;
  avatar: string | null;
}

const ROLE_LABEL: Record<number, string> = { 1: 'Admin', 2: 'Cliente' };

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

  async findAllAdmin(query: AdminUsersQueryDto) {
    const { search, role, status, page = 1, limit = 20 } = query;

    const where: Prisma.UserWhereInput = {};

    if (role !== undefined) {
      where.role = role;
    }

    if (status) {
      where.status = status as 'ACTIVE' | 'BLOCKED';
    }

    if (search) {
      const term = search.trim();
      if (term) {
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { username: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          nickname: true,
          username: true,
          email: true,
          role: true,
          status: true,
          avatar: true,
          city: true,
          createdAt: true,
        },
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => ({
        ...u,
        roleLabel: ROLE_LABEL[u.role] ?? `Role ${u.role}`,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    };
  }

  async findAdminById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        nickname: true,
        username: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        city: true,
        phone: true,
        birthDate: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return {
      ...user,
      roleLabel: ROLE_LABEL[user.role] ?? `Role ${user.role}`,
    };
  }

  async updateStatus(id: number, status: 'ACTIVE' | 'BLOCKED') {
    await this.findAdminById(id);

    if (status === 'BLOCKED') {
      await this.prisma.refreshToken.deleteMany({
        where: { userId: id, expiresAt: { gt: new Date() } },
      });
    }

    await this.prisma.user.update({ where: { id }, data: { status } });

    return this.findAdminById(id);
  }

  async updateRole(id: number, role: 1 | 2) {
    await this.findAdminById(id);

    await this.prisma.user.update({ where: { id }, data: { role } });

    return this.findAdminById(id);
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