import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MyEventsQueryDto } from './dto/profile.dto';

@Injectable()
export class UserEventsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(
    userId: number,
    { filter = 'favorites', page = 1, limit = 20 }: MyEventsQueryDto,
  ) {
    const now = new Date();
    const past: Prisma.EventWhereInput = {
      OR: [
        { status: 'FINISHED' },
        { endAt: { lt: now } },
        { endAt: null, startAt: { lt: now } },
      ],
    };
    const where: Prisma.EventWhereInput =
      filter === 'favorites'
        ? { favorites: { some: { userId } } }
        : {
            participants: { some: { userId } },
            ...(filter === 'history'
              ? past
              : {
                  status: { not: 'FINISHED' },
                  OR: [
                    { endAt: { gte: now } },
                    { endAt: null, startAt: { gte: now } },
                  ],
                }),
          };
    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startAt: filter === 'history' ? 'desc' : 'asc' },
        include: {
          favorites: { where: { userId }, select: { id: true } },
          participants: { where: { userId }, select: { id: true } },
        },
      }),
      this.prisma.event.count({ where }),
    ]);
    return {
      data: events.map(({ favorites, participants, ...event }) => ({
        ...event,
        isFavorite: favorites.length > 0,
        isParticipant: participants.length > 0,
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
  async removeFavorite(userId: number, eventId: number) {
    await this.prisma.favorite.deleteMany({ where: { userId, eventId } });
    return { success: true };
  }
  async cancelParticipation(userId: number, eventId: number) {
    await this.prisma.eventParticipant.deleteMany({
      where: { userId, eventId },
    });
    return { success: true };
  }
}
