import { HttpStatus } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ErrorCode } from '../common/errors/error-codes';

import { LocationsService } from './locations.service';

jest.mock('@nestjs/common', () => require('../test/mock-nest-common'));

const member = (
  userId: number,
  overrides: Record<string, unknown> = {},
) => ({
  id: `gm_${userId}`,
  groupId: 1,
  userId,
  role: 'MEMBER',
  joinedAt: new Date('2026-01-01T00:00:00Z'),
  user: {
    id: userId,
    name: `Nome ${userId}`,
    username: `user_${userId}`,
    avatar: null,
    locationSharingLevel: 'PRIVATE',
    location: {
      id: `loc_${userId}`,
      userId,
      latitude: -22.917,
      longitude: -43.182,
      accuracy: null,
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    },
  },
  ...overrides,
});

describe('LocationsService', () => {
  let service: LocationsService;
  let groupMember: Record<string, jest.Mock>;
  let block: Record<string, jest.Mock>;
  let friendship: Record<string, jest.Mock>;
  let location: Record<string, jest.Mock>;
  let user: Record<string, jest.Mock>;

  beforeEach(() => {
    groupMember = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    };
    block = { findMany: jest.fn() };
    friendship = { findMany: jest.fn() };
    location = { upsert: jest.fn(), findUnique: jest.fn() };
    user = { findUnique: jest.fn() };

    service = new LocationsService({
      groupMember,
      block,
      friendship,
      location,
      user,
    } as unknown as PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('updateLocation', () => {
    it('upserts the location when the user shares location', async () => {
      user.findUnique.mockResolvedValue({ locationSharingLevel: 'GROUP' });
      location.upsert.mockResolvedValue({
        latitude: -22.917,
        longitude: -43.182,
        accuracy: 12,
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      });

      await service.updateLocation(7, {
        latitude: -22.917,
        longitude: -43.182,
        accuracy: 12,
      });

      expect(location.upsert).toHaveBeenCalledWith({
        where: { userId: 7 },
        create: {
          userId: 7,
          latitude: -22.917,
          longitude: -43.182,
          accuracy: 12,
        },
        update: expect.objectContaining({
          latitude: -22.917,
          longitude: -43.182,
          accuracy: 12,
          updatedAt: expect.any(Date),
        }),
        select: {
          latitude: true,
          longitude: true,
          accuracy: true,
          updatedAt: true,
        },
      });
      expect(location.findUnique).not.toHaveBeenCalled();
    });

    it('omits accuracy when it is not provided', async () => {
      user.findUnique.mockResolvedValue({ locationSharingLevel: 'PUBLIC' });
      location.upsert.mockResolvedValue({});

      await service.updateLocation(7, {
        latitude: 0,
        longitude: 0,
      });

      expect(location.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { userId: 7, latitude: 0, longitude: 0 },
          update: expect.not.objectContaining({ accuracy: expect.anything() }),
        }),
      );
    });

    it('never persists the location when sharing level is PRIVATE', async () => {
      user.findUnique.mockResolvedValue({ locationSharingLevel: 'PRIVATE' });
      location.findUnique.mockResolvedValue(null);

      const result = await service.updateLocation(7, {
        latitude: -22.917,
        longitude: -43.182,
      });

      expect(location.upsert).not.toHaveBeenCalled();
      expect(location.findUnique).toHaveBeenCalledWith({
        where: { userId: 7 },
        select: {
          latitude: true,
          longitude: true,
          accuracy: true,
          updatedAt: true,
        },
      });
      expect(result).toBeNull();
    });

    it('returns a previously stored entry without persisting when PRIVATE', async () => {
      user.findUnique.mockResolvedValue({ locationSharingLevel: 'PRIVATE' });
      const stored = {
        latitude: -22.917,
        longitude: -43.182,
        accuracy: null,
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      };
      location.findUnique.mockResolvedValue(stored);

      const result = await service.updateLocation(7, {
        latitude: -10.0,
        longitude: -40.0,
      });

      expect(location.upsert).not.toHaveBeenCalled();
      expect(result).toEqual(stored);
    });

    it('treats an unknown user as PRIVATE', async () => {
      user.findUnique.mockResolvedValue(null);
      location.findUnique.mockResolvedValue(null);

      const result = await service.updateLocation(7, {
        latitude: -22.917,
        longitude: -43.182,
      });

      expect(location.upsert).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('listGroupLocations', () => {
    beforeEach(() => {
      groupMember.findUnique.mockResolvedValue({ id: 'gm_viewer', groupId: 1, userId: 10 });
      block.findMany.mockResolvedValue([]);
      friendship.findMany.mockResolvedValue([]);
    });

    it('rejects users who are not group members', async () => {
      groupMember.findUnique.mockResolvedValue(null);

      await expect(service.listGroupLocations(10, 1)).rejects.toMatchObject({
        code: ErrorCode.GROUP_NOT_MEMBER,
        status: HttpStatus.NOT_FOUND,
      });
      expect(groupMember.findMany).not.toHaveBeenCalled();
    });

    it('skips the viewer and members without a known location', async () => {
      groupMember.findMany.mockResolvedValue([
        member(10, { user: { ...member(10).user, location: { latitude: 1, longitude: 1, updatedAt: new Date() } } }),
        member(20, { user: { ...member(20).user, location: null } }),
      ]);

      const result = await service.listGroupLocations(10, 1);

      expect(result).toHaveLength(0);
    });

    it('never exposes PRIVATE location', async () => {
      groupMember.findMany.mockResolvedValue([
        member(20, { user: { ...member(20).user, locationSharingLevel: 'PRIVATE' } }),
      ]);

      const result = await service.listGroupLocations(10, 1);

      expect(result).toHaveLength(0);
    });

    it('shares GROUP location within the same group regardless of friendship', async () => {
      groupMember.findMany.mockResolvedValue([
        member(20, { user: { ...member(20).user, locationSharingLevel: 'GROUP' } }),
      ]);
      friendship.findMany.mockResolvedValue([]);

      const result = await service.listGroupLocations(10, 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: 20,
        name: 'Nome 20',
        username: 'user_20',
        latitude: -22.917,
        longitude: -43.182,
      });
      expect(result[0].updatedAt).toEqual('2026-01-02T00:00:00.000Z');
      expect(result[0]).not.toHaveProperty('locationSharingLevel');
    });

    it('shares FRIENDS location only with accepted friends', async () => {
      groupMember.findMany.mockResolvedValue([
        member(20, { user: { ...member(20).user, locationSharingLevel: 'FRIENDS' } }),
        member(30, { user: { ...member(30).user, locationSharingLevel: 'FRIENDS' } }),
      ]);
      friendship.findMany.mockResolvedValue([
        { requesterId: 10, receiverId: 20, status: 'ACCEPTED' },
      ]);

      const result = await service.listGroupLocations(10, 1);

      expect(result.map((item) => item.userId)).toEqual([20]);
    });

    it('shares PUBLIC location with every group member', async () => {
      groupMember.findMany.mockResolvedValue([
        member(20, { user: { ...member(20).user, locationSharingLevel: 'PUBLIC' } }),
      ]);

      const result = await service.listGroupLocations(10, 1);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(20);
    });

    it('hides location when either side has blocked the other', async () => {
      groupMember.findMany.mockResolvedValue([
        member(20, { user: { ...member(20).user, locationSharingLevel: 'PUBLIC' } }),
      ]);
      block.findMany.mockResolvedValue([
        { blockerId: 20, blockedId: 10 },
      ]);

      const result = await service.listGroupLocations(10, 1);

      expect(result).toHaveLength(0);
    });

    it('shares FRIENDS location even though a friendship exists but only one direction is asked', async () => {
      groupMember.findMany.mockResolvedValue([
        member(20, { user: { ...member(20).user, locationSharingLevel: 'FRIENDS' } }),
      ]);
      friendship.findMany.mockResolvedValue([
        { requesterId: 20, receiverId: 10, status: 'ACCEPTED' },
      ]);

      const result = await service.listGroupLocations(10, 1);

      expect(result[0].userId).toBe(20);
    });

    it('includes the group creator (OWNER) when they share their location', async () => {
      groupMember.findMany.mockResolvedValue([
        member(5, {
          role: 'OWNER',
          user: { ...member(5).user, locationSharingLevel: 'GROUP' },
        }),
      ]);

      const result = await service.listGroupLocations(10, 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ userId: 5, name: 'Nome 5' });
    });

    it('applies the creator privacy level like any other member', async () => {
      groupMember.findMany.mockResolvedValue([
        member(5, {
          role: 'OWNER',
          user: { ...member(5).user, locationSharingLevel: 'PRIVATE' },
        }),
      ]);

      const result = await service.listGroupLocations(10, 1);

      expect(result).toHaveLength(0);
    });
  });
});