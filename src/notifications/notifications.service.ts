import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { NotificationsQueryDto } from "./dto/notifications-query.dto";

type Tx = Prisma.TransactionClient;

export type NotificationPreferenceKey =
  | "friendRequests"
  | "groupInvites"
  | "groupActivity"
  | "messages"
  | "favoriteEvents"
  | "eventReminders";

export type NotificationActor = {
  id: number;
  name: string;
  avatar: string | null;
};

export interface CreateNotificationParams {
  // Recipient of the notification.
  userId: number;
  // Preference gate used to decide whether to create it.
  category: NotificationPreferenceKey;
  title: string;
  body: string;
  // Flexible routing payload consumed by the client.
  data?: Prisma.InputJsonValue;
}

export interface PublicNotification {
  id: number;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data: Prisma.JsonValue | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a notification for a single recipient, respecting their
   * NotificationPreferences. Pass a transaction client when the caller is
   * already inside a $transaction so the write stays atomic.
   */
  async create(
    client: PrismaService | Tx,
    params: CreateNotificationParams,
  ): Promise<void> {
    const { userId, category, title, body, data } = params;

    const prefs = await client.notificationPreferences.findUnique({
      where: { userId },
    });
    if (prefs && prefs[category] === false) {
      return;
    }

    await client.notification.create({
      data: {
        userId,
        title,
        body,
        data: data ?? undefined,
      },
    });
  }

  async list(
    userId: number,
    { page = 1, limit = 20 }: NotificationsQueryDto,
  ): Promise<{ data: PublicNotification[]; meta: Record<string, unknown> }> {
    const where: Prisma.NotificationWhereInput = { userId };

    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, read: false } }),
    ]);

    return {
      data: items.map((item) => this.mapItem(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        unread,
      },
    };
  }

  async unreadCount(userId: number): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { count };
  }

  async markRead(userId: number, id: number): Promise<{ success: boolean }> {
    const updated = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });

    if (!updated.count) {
      throw new NotFoundException("Notificação não encontrada.");
    }

    return { success: true };
  }

  async markAllRead(userId: number): Promise<{ success: boolean }> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { success: true };
  }

  private mapItem(item: {
    id: number;
    title: string;
    body: string;
    read: boolean;
    createdAt: Date;
    data: Prisma.JsonValue | null;
  }): PublicNotification {
    return {
      id: item.id,
      title: item.title,
      body: item.body,
      read: item.read,
      createdAt: item.createdAt.toISOString(),
      data: item.data,
    };
  }
}
