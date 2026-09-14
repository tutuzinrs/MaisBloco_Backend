import { HttpStatus, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/errors/api-error';
import { ErrorCode } from '../common/errors/error-codes';

import { UpdateLocationDto } from './dto/update-location.dto';

export interface GroupMemberLocation {
  userId: number;
  name: string;
  username: string;
  avatar: string | null;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateLocation(userId: number, dto: UpdateLocationDto) {
    const sharing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locationSharingLevel: true },
    });

    // A user who opted out of sharing (PRIVATE) never has the location
    // persisted. A previously stored entry may still exist in their own
    // account, but it is never exposed to other members by
    // listGroupLocations.
    if (!sharing || sharing.locationSharingLevel === 'PRIVATE') {
      return this.prisma.location.findUnique({
        where: { userId },
        select: {
          latitude: true,
          longitude: true,
          accuracy: true,
          updatedAt: true,
        },
      });
    }

    const data = {
      latitude: dto.latitude,
      longitude: dto.longitude,
      ...(dto.accuracy !== undefined ? { accuracy: dto.accuracy } : {}),
    };

    return this.prisma.location.upsert({
      where: { userId },
      create: { userId, ...data },
      update: { ...data, updatedAt: new Date() },
      select: {
        latitude: true,
        longitude: true,
        accuracy: true,
        updatedAt: true,
      },
    });
  }

  async listGroupLocations(
    viewerId: number,
    groupId: number,
  ): Promise<GroupMemberLocation[]> {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: viewerId } },
    });

    if (!membership) {
      throw new ApiError(
        ErrorCode.GROUP_NOT_MEMBER,
        'Você não participa deste grupo.',
        HttpStatus.NOT_FOUND,
      );
    }

    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            locationSharingLevel: true,
            location: true,
          },
        },
      },
    });

    const memberIds = members.map((member) => member.userId);

    const [blocks, friendships] = await Promise.all([
      this.prisma.block.findMany({
        where: {
          OR: [
            { blockerId: viewerId, blockedId: { in: memberIds } },
            { blockerId: { in: memberIds }, blockedId: viewerId },
          ],
        },
        select: { blockerId: true, blockedId: true },
      }),
      this.prisma.friendship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: viewerId, receiverId: { in: memberIds } },
            { requesterId: { in: memberIds }, receiverId: viewerId },
          ],
        },
        select: { requesterId: true, receiverId: true },
      }),
    ]);

    // A block hides the location regardless of direction.
    const blockedIds = new Set(
      blocks.map((block) =>
        block.blockerId === viewerId ? block.blockedId : block.blockerId,
      ),
    );
    // Accepted friendships involving the viewer.
    const friendIds = new Set(
      friendships.map((friendship) =>
        friendship.requesterId === viewerId
          ? friendship.receiverId
          : friendship.requesterId,
      ),
    );

    const result: GroupMemberLocation[] = [];

    for (const member of members) {
      const user = member.user;
      // The viewer's own location is managed on the device and never duplicated.
      if (user.id === viewerId) continue;
      if (!user.location) continue;
      if (blockedIds.has(user.id)) continue;

      const level = user.locationSharingLevel;
      const allowed =
        level === 'PUBLIC' ||
        level === 'GROUP' ||
        (level === 'FRIENDS' && friendIds.has(user.id));

      if (!allowed) continue;

      result.push({
        userId: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        latitude: user.location.latitude,
        longitude: user.location.longitude,
        updatedAt: user.location.updatedAt.toISOString(),
      });
    }

    return result;
  }
}