import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { FriendsQueryDto } from "./dto/friends.dto";
const publicUser = {
  id: true,
  name: true,
  username: true,
  avatar: true,
} as const;
const actorProfile = {
  id: true,
  name: true,
  username: true,
  avatar: true,
} as const;
const pair = (a: number, b: number) => ({
  OR: [
    { requesterId: a, receiverId: b },
    { requesterId: b, receiverId: a },
  ],
});

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: "Serializable",
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 2
        )
          continue;
        throw error;
      }
    }
  }

  async list(
    userId: number,
    { tab = "friends", page = 1, limit = 20 }: FriendsQueryDto,
  ) {
    const where: Prisma.FriendshipWhereInput = {
      ...(tab === "friends"
        ? {
            status: "ACCEPTED",
            OR: [{ requesterId: userId }, { receiverId: userId }],
          }
        : tab === "received"
          ? { status: "PENDING", receiverId: userId }
          : { status: "PENDING", requesterId: userId }),
      requester: {
        blockedUsers: { none: { blockedId: userId } },
        blockedByUsers: { none: { blockerId: userId } },
      },
      receiver: {
        blockedUsers: { none: { blockedId: userId } },
        blockedByUsers: { none: { blockerId: userId } },
      },
    };
    const [items, total] = await Promise.all([
      this.prisma.friendship.findMany({
        where,
        include: {
          requester: { select: publicUser },
          receiver: { select: publicUser },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.friendship.count({ where }),
    ]);
    return {
      data: items.map((item) => ({
        id: item.id,
        status: item.status,
        user: item.requesterId === userId ? item.receiver : item.requester,
      })),
      meta: { page, limit, total, hasNextPage: page * limit < total },
    };
  }

  request(userId: number, targetId: number) {
    if (userId === targetId)
      throw new BadRequestException("Você não pode adicionar a si mesmo.");
    return this.transaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: { id: targetId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!target) throw new NotFoundException("Usuário não encontrado.");
      const block = await tx.block.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: targetId },
            { blockerId: targetId, blockedId: userId },
          ],
        },
      });
      if (block)
        throw new ConflictException(
          "Não é possível enviar solicitação para este usuário.",
        );
      const existing = await tx.friendship.findFirst({
        where: pair(userId, targetId),
      });
      if (existing)
        throw new ConflictException(
          "Já existe uma amizade ou solicitação entre vocês.",
        );
      const friendship = await tx.friendship.create({
        data: { requesterId: userId, receiverId: targetId },
      });

      const actor = await tx.user.findUnique({
        where: { id: userId },
        select: actorProfile,
      });

      if (actor) {
        await this.notifications.create(tx, {
          userId: targetId,
          category: "friendRequests",
          title: "Nova solicitação de amizade",
          body: `${actor.name} quer ser seu amigo.`,
          data: {
            type: "FRIEND_REQUEST",
            friendshipId: friendship.id,
            actor: {
              id: actor.id,
              name: actor.name,
              username: actor.username,
              avatar: actor.avatar,
            },
          },
        });
      }

      return friendship;
    });
  }

  respond(userId: number, id: number, action: "accept" | "reject") {
    return this.transaction(async (tx) => {
      const item = await tx.friendship.findFirst({
        where: { id, receiverId: userId, status: "PENDING" },
      });
      if (!item)
        throw new NotFoundException(
          "Solicitação não encontrada ou já respondida.",
        );
      if (action === "reject") {
        await tx.friendship.delete({ where: { id } });
        const actor = await tx.user.findUnique({
          where: { id: userId },
          select: actorProfile,
        });
        if (actor)
          await this.notifications.create(tx, {
            userId: item.requesterId,
            category: "friendRequests",
            title: "Solicitação de amizade recusada",
            body: `${actor.name} recusou sua solicitação de amizade.`,
            data: { type: "FRIEND_REJECTED", friendshipId: item.id, actor },
          });
      } else {
        const blocked = await tx.block.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: item.requesterId },
              { blockerId: item.requesterId, blockedId: userId },
            ],
          },
        });
        if (blocked) throw new ConflictException("Usuário bloqueado.");
        await tx.friendship.update({
          where: { id },
          data: { status: "ACCEPTED" },
        });

        const actor = await tx.user.findUnique({
          where: { id: userId },
          select: actorProfile,
        });

        if (actor) {
          await this.notifications.create(tx, {
            userId: item.requesterId,
            category: "friendRequests",
            title: "Solicitação de amizade aceita",
            body: `${actor.name} aceitou sua solicitação de amizade.`,
            data: {
              type: "FRIEND_ACCEPTED",
              friendshipId: item.id,
              actor: {
                id: actor.id,
                name: actor.name,
                username: actor.username,
                avatar: actor.avatar,
              },
            },
          });
        }
      }
      return { success: true };
    });
  }

  async remove(userId: number, id: number) {
    const deleted = await this.prisma.friendship.deleteMany({
      where: {
        id,
        OR: [
          { requesterId: userId, status: "PENDING" },
          {
            status: "ACCEPTED",
            OR: [{ requesterId: userId }, { receiverId: userId }],
          },
        ],
      },
    });
    if (!deleted.count)
      throw new NotFoundException("Amizade ou solicitação não encontrada.");
    return { success: true };
  }

  async blocks(userId: number, { page = 1, limit = 20 }: FriendsQueryDto) {
    const where = { blockerId: userId };
    const [items, total] = await Promise.all([
      this.prisma.block.findMany({
        where,
        include: { blocked: { select: publicUser } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.block.count({ where }),
    ]);
    return {
      data: items.map((item) => ({ id: item.id, user: item.blocked })),
      meta: { page, limit, total, hasNextPage: page * limit < total },
    };
  }

  block(userId: number, targetId: number) {
    if (userId === targetId)
      throw new BadRequestException("Você não pode bloquear a si mesmo.");
    return this.transaction(async (tx) => {
      if (
        !(await tx.user.findUnique({
          where: { id: targetId },
          select: { id: true },
        }))
      )
        throw new NotFoundException("Usuário não encontrado.");
      await tx.block.upsert({
        where: {
          blockerId_blockedId: { blockerId: userId, blockedId: targetId },
        },
        create: { blockerId: userId, blockedId: targetId },
        update: {},
      });
      await tx.friendship.deleteMany({ where: pair(userId, targetId) });
      return { success: true };
    });
  }
  async unblock(userId: number, targetId: number) {
    await this.prisma.block.deleteMany({
      where: { blockerId: userId, blockedId: targetId },
    });
    return { success: true };
  }
}
