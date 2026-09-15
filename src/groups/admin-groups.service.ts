import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { AdminGroupsQueryDto } from './dto/admin-groups-query.dto';

type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER';

const RANK: Record<GroupRole, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

export interface AdminGroupListItem {
  id: number;
  name: string;
  description: string | null;
  avatar: string | null;
  ownerId: number;
  ownerName: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminGroupDetail extends AdminGroupListItem {
  members: AdminGroupMemberItem[];
}

export interface AdminGroupMemberItem {
  userId: number;
  name: string;
  username: string;
  avatar: string | null;
  role: GroupRole;
  joinedAt: string;
}

@Injectable()
export class AdminGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: AdminGroupsQueryDto,
  ): Promise<{ data: AdminGroupListItem[]; meta: Record<string, unknown> }> {
    const { search, page = 1, limit = 20 } = query;

    const where: Prisma.GroupWhereInput = search
      ? {
          OR: [
            { name: { contains: search.trim(), mode: 'insensitive' } },
            { description: { contains: search.trim(), mode: 'insensitive' } },
          ],
        }
      : {};

    const [groups, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true } },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.group.count({ where }),
    ]);

    return {
      data: groups.map((group) => this.mapListItem(group)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    };
  }

  async findOne(id: number): Promise<{ data: AdminGroupDetail }> {
    const group = await this.requireGroup(id);

    const members = await this.prisma.groupMember.findMany({
      where: { groupId: id },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
    });

    const ordered = [...members].sort(
      (a, b) => RANK[b.role] - RANK[a.role],
    );

    const memberCount = members.length;

    return {
      data: {
        ...this.mapListItem({ ...group, _count: { members: memberCount } }),
        members: ordered.map(({ user, role, joinedAt }) => ({
          userId: user.id,
          name: user.name,
          username: user.username,
          avatar: user.avatar,
          role,
          joinedAt: joinedAt.toISOString(),
        })),
      },
    };
  }

  private async requireGroup(groupId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { owner: { select: { id: true, name: true } } },
    });

    if (!group) {
      throw new NotFoundException('Grupo não encontrado.');
    }

    return group;
  }

  private mapListItem(group: {
    id: number;
    name: string;
    description: string | null;
    avatar: string | null;
    ownerId: number;
    createdAt: Date;
    updatedAt: Date;
    owner: { id: number; name: string };
    _count: { members: number };
  }): AdminGroupListItem {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      avatar: group.avatar,
      ownerId: group.owner.id,
      ownerName: group.owner.name,
      memberCount: group._count.members,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }
}