import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ApiError } from "../common/errors/api-error";
import { ErrorCode } from "../common/errors/error-codes";

import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import { GroupsQueryDto } from "./dto/groups-query.dto";
import { AssignableRole } from "./dto/change-role.dto";

type GroupRole = "OWNER" | "ADMIN" | "MEMBER";

const RANK: Record<GroupRole, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

interface GroupRecord {
  id: number;
  name: string;
  description: string | null;
  avatar: string | null;
  ownerId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupListItem {
  id: number;
  name: string;
  description: string | null;
  avatar: string | null;
  ownerId: number;
  memberCount: number;
  role: GroupRole;
  linkedEventName: string | null;
  lastActivity: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberItem {
  userId: number;
  name: string;
  username: string;
  avatar: string | null;
  role: GroupRole;
  joinedAt: string;
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: number, dto: CreateGroupDto): Promise<GroupListItem> {
    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          avatar: dto.avatar ?? null,
          ownerId: userId,
        },
      });

      await tx.groupMember.create({
        data: { groupId: created.id, userId, role: "OWNER" },
      });

      return created;
    });

    return this.mapGroup(group, 1, "OWNER");
  }

  async findMyGroups(
    userId: number,
    query: GroupsQueryDto,
  ): Promise<{ data: GroupListItem[]; meta: Record<string, unknown> }> {
    const { search, page = 1, limit = 20 } = query;

    const where: Prisma.GroupMemberWhereInput = {
      userId,
      ...(search ? { group: this.searchWhere(search) } : {}),
    };

    const [memberships, total] = await Promise.all([
      this.prisma.groupMember.findMany({
        where,
        include: {
          group: {
            include: { _count: { select: { members: true } } },
          },
        },
        orderBy: { joinedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.groupMember.count({ where }),
    ]);

    const data = memberships.map((membership) =>
      this.mapGroup(
        membership.group,
        membership.group._count.members,
        membership.role,
      ),
    );

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    };
  }

  async findOne(userId: number, groupId: number): Promise<GroupListItem> {
    const membership = await this.requireMembership(userId, groupId);
    const group = await this.requireGroup(groupId);

    const memberCount = await this.prisma.groupMember.count({
      where: { groupId },
    });

    return this.mapGroup(group, memberCount, membership.role);
  }

  async findMembers(
    userId: number,
    groupId: number,
  ): Promise<{ data: MemberItem[] }> {
    await this.requireMembership(userId, groupId);
    await this.requireGroup(groupId);

    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    const ordered = [...members].sort((a, b) => RANK[b.role] - RANK[a.role]);

    return {
      data: ordered.map(({ user, role, joinedAt }) => ({
        userId: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        role,
        joinedAt: joinedAt.toISOString(),
      })),
    };
  }

  async join(userId: number, groupId: number): Promise<GroupListItem> {
    await this.requireGroup(groupId);

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (existing) {
      throw new ApiError(
        ErrorCode.GROUP_ALREADY_MEMBER,
        "Você já participa deste grupo.",
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.create({
        data: { groupId, userId, role: "MEMBER" },
      });
      const [group, actor] = await Promise.all([
        tx.group.findUnique({
          where: { id: groupId },
          select: { name: true, ownerId: true },
        }),
        tx.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, username: true, avatar: true },
        }),
      ]);
      if (group && actor && group.ownerId !== userId)
        await this.notifications.create(tx, {
          userId: group.ownerId,
          category: "groupActivity",
          title: "Novo membro no grupo",
          body: `${actor.name} entrou no grupo "${group.name}".`,
          data: {
            type: "GROUP_MEMBER_JOINED",
            groupId,
            groupName: group.name,
            actor,
          },
        });
    });

    return this.findOne(userId, groupId);
  }

  async addMember(
    actorId: number,
    groupId: number,
    memberId: number,
  ): Promise<{ data: MemberItem }> {
    const actor = await this.requireMembership(actorId, groupId);
    if (actor.role === "MEMBER") {
      throw new ApiError(
        ErrorCode.GROUP_ROLE_FORBIDDEN,
        "Somente administradores podem adicionar membros.",
        HttpStatus.FORBIDDEN,
      );
    }

    const target = await this.prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, username: true, avatar: true },
    });

    if (!target) {
      throw new ApiError(
        ErrorCode.GROUP_NOT_FOUND,
        "Usuário não encontrado.",
        HttpStatus.NOT_FOUND,
      );
    }

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: memberId } },
    });

    if (existing) {
      throw new ApiError(
        ErrorCode.GROUP_ALREADY_MEMBER,
        "Este usuário já participa do grupo.",
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.groupMember.create({
        data: { groupId, userId: memberId, role: "MEMBER" },
      });

      const [group, actorProfile] = await Promise.all([
        tx.group.findUnique({
          where: { id: groupId },
          select: { name: true },
        }),
        tx.user.findUnique({
          where: { id: actorId },
          select: { id: true, name: true, username: true, avatar: true },
        }),
      ]);

      if (group && actorProfile) {
        await this.notifications.create(tx, {
          userId: memberId,
          category: "groupActivity",
          title: "Você foi adicionado a um grupo",
          body: `${actorProfile.name} adicionou você ao grupo "${group.name}".`,
          data: {
            type: "GROUP_MEMBER_ADDED",
            groupId,
            groupName: group.name,
            actor: {
              id: actorProfile.id,
              name: actorProfile.name,
              username: actorProfile.username,
              avatar: actorProfile.avatar,
            },
          },
        });
      }

      return {
        data: {
          userId: target.id,
          name: target.name,
          username: target.username,
          avatar: target.avatar,
          role: membership.role,
          joinedAt: membership.joinedAt.toISOString(),
        },
      };
    });
  }

  async leave(userId: number, groupId: number): Promise<{ success: boolean }> {
    const membership = await this.requireMembership(userId, groupId);
    await this.requireGroup(groupId);

    if (membership.role === "OWNER") {
      const memberCount = await this.prisma.groupMember.count({
        where: { groupId },
      });

      if (memberCount > 1) {
        throw new ApiError(
          ErrorCode.GROUP_OWNER_CANNOT_LEAVE,
          "O dono do grupo não pode sair enquanto houver outros membros.",
          HttpStatus.CONFLICT,
        );
      }

      await this.prisma.$transaction([
        this.prisma.groupMember.delete({
          where: { id: membership.id },
        }),
        this.prisma.group.delete({ where: { id: groupId } }),
      ]);

      return { success: true };
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({
        where: { id: membership.id },
      });

      const [group, leaver] = await Promise.all([
        tx.group.findUnique({
          where: { id: groupId },
          select: { name: true, ownerId: true },
        }),
        tx.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, username: true, avatar: true },
        }),
      ]);

      if (group && leaver && group.ownerId !== userId) {
        await this.notifications.create(tx, {
          userId: group.ownerId,
          category: "groupActivity",
          title: "Membro saiu do grupo",
          body: `${leaver.name} saiu do grupo "${group.name}".`,
          data: {
            type: "GROUP_MEMBER_LEFT",
            groupId,
            groupName: group.name,
            actor: {
              id: leaver.id,
              name: leaver.name,
              username: leaver.username,
              avatar: leaver.avatar,
            },
          },
        });
      }

      return { success: true };
    });
  }

  async removeMember(
    actorId: number,
    groupId: number,
    memberId: number,
  ): Promise<{ success: boolean }> {
    const actor = await this.requireMembership(actorId, groupId);
    const target = await this.findMembershipOrThrow(groupId, memberId);

    if (actor.role === "MEMBER") {
      throw new ApiError(
        ErrorCode.GROUP_ROLE_FORBIDDEN,
        "Somente administradores podem remover membros.",
        HttpStatus.FORBIDDEN,
      );
    }

    if (target.role === "OWNER") {
      throw new ApiError(
        ErrorCode.GROUP_CANNOT_REMOVE_OWNER,
        "O dono do grupo não pode ser removido.",
        HttpStatus.FORBIDDEN,
      );
    }

    if (actor.role === "ADMIN" && target.role !== "MEMBER") {
      throw new ApiError(
        ErrorCode.GROUP_ROLE_FORBIDDEN,
        "Administradores só podem remover membros comuns.",
        HttpStatus.FORBIDDEN,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({ where: { id: target.id } });

      const [group, actorProfile] = await Promise.all([
        tx.group.findUnique({
          where: { id: groupId },
          select: { name: true, ownerId: true },
        }),
        tx.user.findUnique({
          where: { id: actorId },
          select: { id: true, name: true, username: true, avatar: true },
        }),
      ]);

      if (group && actorProfile) {
        const removed = await tx.user.findUnique({
          where: { id: memberId },
          select: { id: true, name: true, username: true, avatar: true },
        });

        if (removed) {
          await this.notifications.create(tx, {
            userId: removed.id,
            category: "groupActivity",
            title: "Você foi removido de um grupo",
            body: `${actorProfile.name} removeu você do grupo "${group.name}".`,
            data: {
              type: "GROUP_MEMBER_REMOVED",
              groupId,
              groupName: group.name,
              actor: {
                id: actorProfile.id,
                name: actorProfile.name,
                username: actorProfile.username,
                avatar: actorProfile.avatar,
              },
            },
          });
        }
      }

      return { success: true };
    });
  }

  async update(
    userId: number,
    groupId: number,
    dto: UpdateGroupDto,
  ): Promise<GroupListItem> {
    const membership = await this.requireMembership(userId, groupId);
    if (membership.role !== "OWNER") {
      throw new ApiError(
        ErrorCode.GROUP_ROLE_FORBIDDEN,
        "Somente o dono do grupo pode alterar as informações.",
        HttpStatus.FORBIDDEN,
      );
    }

    const data: Prisma.GroupUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      data.description =
        dto.description === null ? null : dto.description.trim();
    }
    if (dto.avatar !== undefined) {
      data.avatar = dto.avatar === null ? null : dto.avatar;
    }

    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.group.findUniqueOrThrow({
        where: { id: groupId },
      });
      const updated = await tx.group.update({ where: { id: groupId }, data });
      const changed =
        previous.name !== updated.name ||
        previous.description !== updated.description ||
        previous.avatar !== updated.avatar;
      if (changed) {
        const [members, actor] = await Promise.all([
          tx.groupMember.findMany({
            where: { groupId, userId: { not: userId } },
            select: { userId: true },
          }),
          tx.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, username: true, avatar: true },
          }),
        ]);
        if (actor)
          for (const member of members)
            await this.notifications.create(tx, {
              userId: member.userId,
              category: "groupActivity",
              title: "Grupo atualizado",
              body: `${actor.name} atualizou as informações do grupo "${updated.name}".`,
              data: {
                type: "GROUP_UPDATED",
                groupId,
                groupName: updated.name,
                actor,
              },
            });
      }
      const memberCount = await tx.groupMember.count({ where: { groupId } });
      return this.mapGroup(updated, memberCount, membership.role);
    });
  }

  async changeRole(
    actorId: number,
    groupId: number,
    memberId: number,
    role: AssignableRole,
  ): Promise<{ data: MemberItem }> {
    const actor = await this.requireMembership(actorId, groupId);
    if (actor.role !== "OWNER") {
      throw new ApiError(
        ErrorCode.GROUP_ROLE_FORBIDDEN,
        "Somente o dono do grupo pode alterar papéis.",
        HttpStatus.FORBIDDEN,
      );
    }

    if (actorId === memberId) {
      throw new ApiError(
        ErrorCode.GROUP_CANNOT_CHANGE_OWNER_ROLE,
        "O dono do grupo não pode alterar o próprio papel.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const target = await this.findMembershipOrThrow(groupId, memberId);
    if (target.role === "OWNER") {
      throw new ApiError(
        ErrorCode.GROUP_CANNOT_CHANGE_OWNER_ROLE,
        "O papel do dono do grupo não pode ser alterado.",
        HttpStatus.FORBIDDEN,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.groupMember.update({
        where: { id: target.id },
        data: { role },
        include: {
          user: {
            select: { id: true, name: true, username: true, avatar: true },
          },
        },
      });

      const [group, actorProfile] = await Promise.all([
        tx.group.findUnique({
          where: { id: groupId },
          select: { name: true },
        }),
        tx.user.findUnique({
          where: { id: actorId },
          select: { id: true, name: true, username: true, avatar: true },
        }),
      ]);

      if (
        group &&
        actorProfile &&
        memberId !== actorId &&
        target.role !== role
      ) {
        const roleLabel = role === "ADMIN" ? "administrador" : "membro";
        await this.notifications.create(tx, {
          userId: memberId,
          category: "groupActivity",
          title: "Seu papel no grupo mudou",
          body: `${actorProfile.name} definiu você como ${roleLabel} no grupo "${group.name}".`,
          data: {
            type: "GROUP_ROLE_CHANGED",
            groupId,
            groupName: group.name,
            role,
            actor: {
              id: actorProfile.id,
              name: actorProfile.name,
              username: actorProfile.username,
              avatar: actorProfile.avatar,
            },
          },
        });
      }

      return {
        data: {
          userId: updated.user.id,
          name: updated.user.name,
          username: updated.user.username,
          avatar: updated.user.avatar,
          role: updated.role,
          joinedAt: updated.joinedAt.toISOString(),
        },
      };
    });
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  async requireGroup(groupId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new ApiError(
        ErrorCode.GROUP_NOT_FOUND,
        "Grupo não encontrado.",
        HttpStatus.NOT_FOUND,
      );
    }

    return group;
  }

  async requireMembership(userId: number, groupId: number) {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!membership) {
      throw new ApiError(
        ErrorCode.GROUP_NOT_MEMBER,
        "Você não participa deste grupo.",
        HttpStatus.NOT_FOUND,
      );
    }

    return membership;
  }

  private async findMembershipOrThrow(groupId: number, userId: number) {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!membership) {
      throw new ApiError(
        ErrorCode.GROUP_NOT_MEMBER,
        "Este usuário não participa do grupo.",
        HttpStatus.NOT_FOUND,
      );
    }

    return membership;
  }

  private searchWhere(search: string): Prisma.GroupWhereInput {
    const term = search.trim();
    return {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ],
    };
  }

  private mapGroup(
    group: GroupRecord,
    memberCount: number,
    role: GroupRole,
  ): GroupListItem {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      avatar: group.avatar,
      ownerId: group.ownerId,
      memberCount,
      role,
      linkedEventName: null,
      lastActivity: null,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }
}
