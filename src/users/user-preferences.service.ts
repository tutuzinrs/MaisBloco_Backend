import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPreferencesDto, PrivacyDto } from './dto/profile.dto';

const defaults = {
  friendRequests: true,
  groupInvites: true,
  messages: true,
  groupActivity: true,
  favoriteEvents: true,
  eventReminders: true,
};
const select = {
  friendRequests: true,
  groupInvites: true,
  messages: true,
  groupActivity: true,
  favoriteEvents: true,
  eventReminders: true,
} as const;

@Injectable()
export class UserPreferencesService {
  constructor(private readonly prisma: PrismaService) {}
  privacy(userId: number) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { locationSharingLevel: true },
    });
  }
  updatePrivacy(userId: number, dto: PrivacyDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { locationSharingLevel: dto.locationSharingLevel },
      select: { locationSharingLevel: true },
    });
  }
  async notifications(userId: number) {
    return (
      (await this.prisma.notificationPreferences.findUnique({
        where: { userId },
        select,
      })) ?? defaults
    );
  }
  updateNotifications(userId: number, dto: NotificationPreferencesDto) {
    return this.prisma.notificationPreferences.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
      select,
    });
  }
}
