import { HttpStatus, Injectable } from '@nestjs/common';
import { GroupInviteStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/errors/api-error';
import { ErrorCode } from '../common/errors/error-codes';

import { GroupsService } from './groups.service';
import { CreateGroupInvitesDto } from './dto/create-group-invites.dto';
import { GroupInvitesQueryDto } from './dto/group-invites-query.dto';

type Tx = Prisma.TransactionClient;

export interface InvitedUserSummary {
  userId: string;
  name: string;
  username: string;
  avatar: string | null;
}

export interface GroupInviteItem {
  id: string;
  groupId: string;
  status: GroupInviteStatus;
  createdAt: string;
  expiresAt: string | null;
  inviter: InvitedUserSummary;
  invitee: InvitedUserSummary;
}

export interface ReceivedInviteItem {
  id: string;
  status: GroupInviteStatus;
  createdAt: string;
  expiresAt: string | null;
  group: {
    groupId: string;
    name: string;
    avatar: string | null;
    memberCount: number;
  };
  inviter: InvitedUserSummary;
}

export interface SentInviteItem {
  id: string;
  status: GroupInviteStatus;
  createdAt: string;
  expiresAt: string | null;
  group: {
    groupId: string;
    name: string;
    avatar: string | null;
  };
  invitee: InvitedUserSummary;
}

export interface CreateInvitesResult {
  data: GroupInviteItem[];
  failed: Array<{ userId: string; code: ErrorCode; message: string }>;
}

interface UserSummaryRecord {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

interface InviteRecordWithUsers {
  id: string;
  groupId: string;
  status: GroupInviteStatus;
  createdAt: Date;
  expiresAt: Date | null;
  inviter: UserSummaryRecord;
  invitee: UserSummaryRecord;
}

const REACTIVATABLE_STATUSES: GroupInviteStatus[] = [
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
];

@Injectable()
export class GroupInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

  async create(
    actorId: string,
    groupId: string,
    dto: CreateGroupInvitesDto,
  ): Promise<CreateInvitesResult> {
    const membership = await this.groupsService.requireMembership(
      actorId,
      groupId,
    );
    await this.groupsService.requireGroup(groupId);

    if (membership.role === 'MEMBER') {
      throw new ApiError(
        ErrorCode.GROUP_ROLE_FORBIDDEN,
        'Somente o dono do grupo e os administradores podem convidar pessoas.',
        HttpStatus.FORBIDDEN,
      );
    }

    const userIds = [...new Set(dto.userIds)];

    const results = await this.prisma.$transaction(async (tx) => {
      const data: GroupInviteItem[] = [];
      const failed: CreateInvitesResult['failed'] = [];

      for (const inviteeId of userIds) {
        const outcome = await this.createOne(tx, {
          actorId,
          groupId,
          inviteeId,
        });

        if (outcome.item) {
          data.push(outcome.item);
        } else {
          failed.push({
            userId: inviteeId,
            ...outcome.error,
          });
        }
      }

      return { data, failed };
    });

    return results;
  }

  async findReceived(
    userId: string,
    query: GroupInvitesQueryDto,
  ): Promise<{ data: ReceivedInviteItem[]; meta: Record<string, unknown> }> {
    const { search, page = 1, limit = 20 } = query;

    const where: Prisma.GroupInviteWhereInput = {
      inviteeId: userId,
      status: 'PENDING',
      ...(search
        ? { group: { name: { contains: search.trim(), mode: 'insensitive' } } }
        : {}),
    };

    const [invites, total] = await Promise.all([
      this.prisma.groupInvite.findMany({
        where,
        include: {
          group: { include: { _count: { select: { members: true } } } },
          inviter: {
            select: { id: true, name: true, username: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.groupInvite.count({ where }),
    ]);

    const now = new Date();

    return {
      data: invites.map((invite) => ({
        id: invite.id,
        status: this.effectiveStatus(invite.expiresAt, now),
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
        group: {
          groupId: invite.groupId,
          name: invite.group.name,
          avatar: invite.group.avatar,
          memberCount: invite.group._count.members,
        },
        inviter: {
          userId: invite.inviter.id,
          name: invite.inviter.name,
          username: invite.inviter.username,
          avatar: invite.inviter.avatar,
        },
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

  async findSent(
    userId: string,
    query: GroupInvitesQueryDto,
  ): Promise<{ data: SentInviteItem[]; meta: Record<string, unknown> }> {
    const { search, page = 1, limit = 20 } = query;

    const where: Prisma.GroupInviteWhereInput = {
      inviterId: userId,
      status: { in: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'] },
      ...(search
        ? {
            invitee: { name: { contains: search.trim(), mode: 'insensitive' } },
          }
        : {}),
    };

    const [invites, total] = await Promise.all([
      this.prisma.groupInvite.findMany({
        where,
        include: {
          group: { select: { id: true, name: true, avatar: true } },
          invitee: {
            select: { id: true, name: true, username: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.groupInvite.count({ where }),
    ]);

    return {
      data: invites.map((invite) => ({
        id: invite.id,
        status: this.effectiveStatus(invite.expiresAt),
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
        group: {
          groupId: invite.groupId,
          name: invite.group.name,
          avatar: invite.group.avatar,
        },
        invitee: this.mapUserSummary(invite.invitee),
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

  async listPending(
    actorId: string,
    groupId: string,
  ): Promise<{ data: GroupInviteItem[] }> {
    const membership = await this.groupsService.requireMembership(
      actorId,
      groupId,
    );
    await this.groupsService.requireGroup(groupId);

    if (membership.role === 'MEMBER') {
      throw new ApiError(
        ErrorCode.GROUP_ROLE_FORBIDDEN,
        'Somente o dono do grupo e os administradores podem ver convites pendentes.',
        HttpStatus.FORBIDDEN,
      );
    }

    const invites = await this.prisma.groupInvite.findMany({
      where: { groupId, status: 'PENDING' },
      include: {
        inviter: {
          select: { id: true, name: true, username: true, avatar: true },
        },
        invitee: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: invites.map((invite) =>
        this.mapGroupInviteItem(invite, this.effectiveStatus(invite.expiresAt)),
      ),
    };
  }

  async accept(
    inviteeId: string,
    inviteId: string,
  ): Promise<{ success: true; groupId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.groupInvite.findUnique({
        where: { id: inviteId },
      });

      if (!invite) {
        throw new ApiError(
          ErrorCode.GROUP_INVITE_NOT_FOUND,
          'Convite não encontrado.',
          HttpStatus.NOT_FOUND,
        );
      }

      if (invite.inviteeId !== inviteeId) {
        throw new ApiError(
          ErrorCode.GROUP_INVITE_FORBIDDEN,
          'Este convite não foi enviado para você.',
          HttpStatus.FORBIDDEN,
        );
      }

      if (this.isExpired(invite.expiresAt)) {
        throw new ApiError(
          ErrorCode.GROUP_INVITE_EXPIRED,
          'Este convite expirou.',
          HttpStatus.CONFLICT,
        );
      }

      if (invite.status !== 'PENDING') {
        throw new ApiError(
          ErrorCode.GROUP_INVITE_NOT_PENDING,
          'Este convite não está mais pendente.',
          HttpStatus.CONFLICT,
        );
      }

      const group = await tx.group.findUnique({
        where: { id: invite.groupId },
        select: { id: true },
      });

      if (!group) {
        throw new ApiError(
          ErrorCode.GROUP_NOT_FOUND,
          'O grupo deste convite não existe mais.',
          HttpStatus.NOT_FOUND,
        );
      }

      const existingMember = await tx.groupMember.findUnique({
        where: {
          groupId_userId: { groupId: invite.groupId, userId: inviteeId },
        },
      });

      if (existingMember) {
        throw new ApiError(
          ErrorCode.GROUP_ALREADY_MEMBER,
          'Você já participa deste grupo.',
          HttpStatus.CONFLICT,
        );
      }

      await tx.groupInvite.deleteMany({
        where: {
          groupId: invite.groupId,
          inviteeId,
          status: 'ACCEPTED',
        },
      });

      await tx.groupMember.create({
        data: { groupId: invite.groupId, userId: inviteeId, role: 'MEMBER' },
      });

      await tx.groupInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });

      return { success: true as const, groupId: invite.groupId };
    });
  }

  async reject(
    inviteeId: string,
    inviteId: string,
  ): Promise<{ success: boolean }> {
    const invite = await this.prisma.groupInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new ApiError(
        ErrorCode.GROUP_INVITE_NOT_FOUND,
        'Convite não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (invite.inviteeId !== inviteeId) {
      throw new ApiError(
        ErrorCode.GROUP_INVITE_FORBIDDEN,
        'Este convite não foi enviado para você.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (invite.status !== 'PENDING') {
      throw new ApiError(
        ErrorCode.GROUP_INVITE_NOT_PENDING,
        'Este convite não está mais pendente.',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.groupInvite.update({
      where: { id: invite.id },
      data: { status: 'REJECTED' },
    });

    return { success: true };
  }

  async cancel(
    actorId: string,
    groupId: string,
    inviteId: string,
  ): Promise<{ success: boolean }> {
    const membership = await this.groupsService.requireMembership(
      actorId,
      groupId,
    );

    const invite = await this.prisma.groupInvite.findFirst({
      where: { id: inviteId, groupId },
    });

    if (!invite) {
      throw new ApiError(
        ErrorCode.GROUP_INVITE_NOT_FOUND,
        'Convite não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (membership.role === 'MEMBER' && invite.inviterId !== actorId) {
      throw new ApiError(
        ErrorCode.GROUP_INVITE_FORBIDDEN,
        'Você não pode cancelar este convite.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (invite.status !== 'PENDING') {
      throw new ApiError(
        ErrorCode.GROUP_INVITE_NOT_PENDING,
        'Este convite não está mais pendente.',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.groupInvite.update({
      where: { id: invite.id },
      data: { status: 'CANCELLED' },
    });

    return { success: true };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async createOne(
    tx: Tx,
    params: { actorId: string; groupId: string; inviteeId: string },
  ): Promise<
    | { item: GroupInviteItem; error?: undefined }
    | { item?: undefined; error: { code: ErrorCode; message: string } }
  > {
    const { actorId, groupId, inviteeId } = params;

    if (inviteeId === actorId) {
      return {
        error: {
          code: ErrorCode.GROUP_INVITE_SELF,
          message: 'Você não pode se convidar para o próprio grupo.',
        },
      };
    }

    const target = await tx.user.findUnique({
      where: { id: inviteeId },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        status: true,
      },
    });

    if (!target || target.status !== 'ACTIVE') {
      return {
        error: {
          code: ErrorCode.GROUP_INVITE_TARGET_UNAVAILABLE,
          message: 'Usuário não encontrado ou indisponível.',
        },
      };
    }

    const existingMember = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: inviteeId } },
    });

    if (existingMember) {
      return {
        error: {
          code: ErrorCode.GROUP_ALREADY_MEMBER,
          message: 'Este usuário já participa do grupo.',
        },
      };
    }

    const blocked = await this.isBlocked(tx, actorId, inviteeId);
    if (blocked) {
      return {
        error: {
          code: ErrorCode.GROUP_INVITE_BLOCKED,
          message: 'Não é possível convidar este usuário.',
        },
      };
    }

    const existingInvite = await tx.groupInvite.findFirst({
      where: {
        groupId,
        inviteeId,
        status: { in: REACTIVATABLE_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        inviter: {
          select: { id: true, name: true, username: true, avatar: true },
        },
        invitee: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
    });

    if (existingInvite) {
      const updated = await tx.groupInvite.update({
        where: { id: existingInvite.id },
        data: { status: 'PENDING', inviterId: actorId },
        include: {
          inviter: {
            select: { id: true, name: true, username: true, avatar: true },
          },
          invitee: {
            select: { id: true, name: true, username: true, avatar: true },
          },
        },
      });

      return { item: this.mapGroupInviteItem(updated) };
    }

    try {
      const created = await tx.groupInvite.create({
        data: {
          groupId,
          inviterId: actorId,
          inviteeId,
          status: 'PENDING',
        },
        include: {
          inviter: {
            select: { id: true, name: true, username: true, avatar: true },
          },
          invitee: {
            select: { id: true, name: true, username: true, avatar: true },
          },
        },
      });

      return { item: this.mapGroupInviteItem(created) };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return {
          error: {
            code: ErrorCode.GROUP_INVITE_DUPLICATE,
            message: 'Este usuário já possui um convite pendente para o grupo.',
          },
        };
      }
      throw err;
    }
  }

  private mapGroupInviteItem(
    invite: InviteRecordWithUsers,
    effectiveStatus: GroupInviteStatus = invite.status,
  ): GroupInviteItem {
    return {
      id: invite.id,
      groupId: invite.groupId,
      status: effectiveStatus,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
      inviter: this.mapUserSummary(invite.inviter),
      invitee: this.mapUserSummary(invite.invitee),
    };
  }

  private mapUserSummary(user: UserSummaryRecord): InvitedUserSummary {
    return {
      userId: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
    };
  }

  private async isBlocked(tx: Tx, actorId: string, targetId: string) {
    const block = await tx.block.findFirst({
      where: {
        OR: [
          { blockerId: actorId, blockedId: targetId },
          { blockerId: targetId, blockedId: actorId },
        ],
      },
    });
    return Boolean(block);
  }

  private isExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) return false;
    return expiresAt.getTime() <= Date.now();
  }

  private effectiveStatus(
    expiresAt: Date | null,
    now: Date = new Date(),
  ): GroupInviteStatus {
    if (expiresAt && expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
    return 'PENDING';
  }
}