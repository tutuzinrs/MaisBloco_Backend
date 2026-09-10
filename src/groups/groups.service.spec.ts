import { HttpStatus } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ErrorCode } from '../common/errors/error-codes';

import { GroupsService } from './groups.service';

// NestJS 12 ships ESM-only builds that the CJS Jest runtime on this Node
// version cannot require. Swap the module with the runtime facade.
jest.mock('@nestjs/common', () => require('../test/mock-nest-common'));

const groupMock = (overrides: Record<string, unknown> = {}) => ({
  id: 'group_1',
  name: 'Carnaval 2027',
  description: 'Grupo da galera',
  avatar: null,
  ownerId: 'user_1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const membershipMock = (overrides: Record<string, unknown> = {}) => ({
  id: 'gm_1',
  groupId: 'group_1',
  userId: 'user_1',
  role: 'OWNER',
  joinedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const createDto = () => ({
  name: 'Carnaval 2027',
  description: 'Grupo da galera',
});

describe('GroupsService', () => {
  let service: GroupsService;
  let groupMember: Record<string, jest.Mock>;
  let group: Record<string, jest.Mock>;
  let user: Record<string, jest.Mock>;
  let transaction: jest.Mock;

  beforeEach(() => {
    groupMember = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    group = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    user = { findUnique: jest.fn() };
    transaction = jest.fn();

    const prisma = {
      group,
      groupMember,
      user,
      $transaction: transaction,
    };

    service = new GroupsService(prisma as unknown as PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a group and makes the creator OWNER inside a transaction', async () => {
      const tx = {
        group: { create: jest.fn().mockResolvedValue(groupMock()) },
        groupMember: { create: jest.fn().mockResolvedValue(membershipMock()) },
      };
      transaction.mockImplementation(async (fn: unknown) => {
        if (typeof fn === 'function') return (fn as (t: typeof tx) => unknown)(tx);
        return fn;
      });

      const result = await service.create('user_1', createDto());

      expect(tx.group.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Carnaval 2027',
          ownerId: 'user_1',
        }),
      });
      expect(tx.groupMember.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          groupId: 'group_1',
          userId: 'user_1',
          role: 'OWNER',
        }),
      });
      expect(result).toMatchObject({
        id: 'group_1',
        name: 'Carnaval 2027',
        memberCount: 1,
        role: 'OWNER',
      });
    });

    it('trims name and description before persisting', async () => {
      const tx = {
        group: { create: jest.fn().mockResolvedValue(groupMock()) },
        groupMember: { create: jest.fn().mockResolvedValue(membershipMock()) },
      };
      transaction.mockImplementation(async (fn: unknown) => {
        if (typeof fn === 'function') return (fn as (t: typeof tx) => unknown)(tx);
        return fn;
      });

      await service.create('user_1', {
        name: '  Grupo  ',
        description: '  desc  ',
      });

      expect(tx.group.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Grupo', description: 'desc' }),
      });
    });
  });

  describe('findMyGroups', () => {
    it('returns groups mapped with member count, role and empty optional fields', async () => {
      groupMember.findMany.mockResolvedValue([
        membershipMock({
          role: 'ADMIN',
          group: {
            ...groupMock(),
            _count: { members: 5 },
          },
        }),
      ]);
      groupMember.count.mockResolvedValue(1);

      const result = await service.findMyGroups('user_1', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        name: 'Carnaval 2027',
        memberCount: 5,
        role: 'ADMIN',
        linkedEventName: null,
        lastActivity: null,
      });
      expect(result.meta.total).toBe(1);
      expect(result.meta.hasNextPage).toBe(false);
      expect(groupMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user_1' } }),
      );
    });

    it('searches by name or description when search is provided', async () => {
      groupMember.findMany.mockResolvedValue([]);
      groupMember.count.mockResolvedValue(0);

      await service.findMyGroups('user_1', { search: 'carnaval', page: 1, limit: 20 });

      const where = groupMember.findMany.mock.calls[0][0].where;
      expect(where.userId).toBe('user_1');
      expect(where.group.OR).toEqual(
        expect.arrayContaining([
          { name: { contains: 'carnaval', mode: 'insensitive' } },
          { description: { contains: 'carnaval', mode: 'insensitive' } },
        ]),
      );
    });

    it('caps the limit at the backend maximum', async () => {
      groupMember.findMany.mockResolvedValue([]);
      groupMember.count.mockResolvedValue(0);

      await service.findMyGroups('user_1', { page: 1, limit: 50 });

      expect(groupMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 0 }),
      );
    });
  });

  describe('findOne / access control', () => {
    it('returns group detail for a member', async () => {
      groupMember.findUnique.mockResolvedValue(membershipMock({ role: 'MEMBER' }));
      group.findUnique.mockResolvedValue(groupMock());
      groupMember.count.mockResolvedValue(3);

      const result = await service.findOne('user_2', 'group_1');

      expect(result.memberCount).toBe(3);
      expect(result.role).toBe('MEMBER');
    });

    it('throws NOT_MEMBER for a user who does not belong to the group', async () => {
      groupMember.findUnique.mockResolvedValue(null);

      await expect(service.findOne('stranger', 'group_1')).rejects.toMatchObject({
        code: ErrorCode.GROUP_NOT_MEMBER,
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('throws GROUP_NOT_FOUND for a non-existent group', async () => {
      groupMember.findUnique.mockResolvedValue(membershipMock());
      group.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user_1', 'ghost')).rejects.toMatchObject({
        code: ErrorCode.GROUP_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('blocks non-members from listing members', async () => {
      groupMember.findUnique.mockResolvedValue(null);

      await expect(service.findMembers('stranger', 'group_1')).rejects.toMatchObject({
        code: ErrorCode.GROUP_NOT_MEMBER,
      });
    });

    it('lists members ordered by role rank and only public data', async () => {
      groupMember.findUnique.mockResolvedValue(membershipMock());
      group.findUnique.mockResolvedValue(groupMock());
      groupMember.findMany.mockResolvedValue([
        membershipMock({ id: 'gm_1', userId: 'u1', role: 'MEMBER', user: { id: 'u1', name: 'Ana', username: 'ana', avatar: null } }),
        membershipMock({ id: 'gm_2', userId: 'u2', role: 'ADMIN', user: { id: 'u2', name: 'Bob', username: 'bob', avatar: null } }),
        membershipMock({ id: 'gm_3', userId: 'u3', role: 'OWNER', user: { id: 'u3', name: 'Chef', username: 'chef', avatar: null } }),
      ]);

      const result = await service.findMembers('user_1', 'group_1');

      expect(result.data.map((m) => m.role)).toEqual(['OWNER', 'ADMIN', 'MEMBER']);
      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.data[0]).not.toHaveProperty('email');
    });
  });

  describe('join', () => {
    it('lets a non-member join as MEMBER', async () => {
      group.findUnique.mockResolvedValue(groupMock());
      groupMember.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(membershipMock({ userId: 'user_2', role: 'MEMBER' }));
      groupMember.create.mockResolvedValue(membershipMock({ userId: 'user_2', role: 'MEMBER' }));
      groupMember.count.mockResolvedValue(1);

      const result = await service.join('user_2', 'group_1');

      expect(groupMember.create).toHaveBeenCalledWith({
        data: { groupId: 'group_1', userId: 'user_2', role: 'MEMBER' },
      });
      expect(result).toBeDefined();
    });

    it('rejects duplicate membership with 409', async () => {
      group.findUnique.mockResolvedValue(groupMock());
      groupMember.findUnique.mockResolvedValue(membershipMock());

      await expect(service.join('user_1', 'group_1')).rejects.toMatchObject({
        code: ErrorCode.GROUP_ALREADY_MEMBER,
        status: HttpStatus.CONFLICT,
      });
      expect(groupMember.create).not.toHaveBeenCalled();
    });

    it('throws GROUP_NOT_FOUND when the group does not exist', async () => {
      group.findUnique.mockResolvedValue(null);

      await expect(service.join('user_2', 'ghost')).rejects.toMatchObject({
        code: ErrorCode.GROUP_NOT_FOUND,
      });
    });
  });

  describe('addMember', () => {
    it('lets an OWNER add another user as MEMBER', async () => {
      groupMember.findUnique
        .mockResolvedValueOnce(membershipMock({ role: 'OWNER' }))
        .mockResolvedValueOnce(null);
      user.findUnique.mockResolvedValue({ id: 'u2', name: 'Ana', username: 'ana', avatar: null });
      groupMember.create.mockResolvedValue(membershipMock({ userId: 'u2', role: 'MEMBER', joinedAt: new Date() }));

      const result = await service.addMember('user_1', 'group_1', 'u2');

      expect(result.data).toMatchObject({ userId: 'u2', role: 'MEMBER', name: 'Ana' });
    });

    it('rejects a MEMBER actor with FORBIDDEN', async () => {
      groupMember.findUnique.mockResolvedValue(membershipMock({ role: 'MEMBER' }));

      await expect(
        service.addMember('user_1', 'group_1', 'u2'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_ROLE_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('rejects adding an already existing member with 409', async () => {
      groupMember.findUnique
        .mockResolvedValueOnce(membershipMock({ role: 'OWNER' }))
        .mockResolvedValueOnce(membershipMock({ userId: 'u2', role: 'MEMBER' }));
      user.findUnique.mockResolvedValue({ id: 'u2', name: 'Ana', username: 'ana', avatar: null });

      await expect(
        service.addMember('user_1', 'group_1', 'u2'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_ALREADY_MEMBER,
        status: HttpStatus.CONFLICT,
      });
    });
  });

  describe('leave', () => {
    it('lets a MEMBER leave the group', async () => {
      groupMember.findUnique.mockResolvedValue(
        membershipMock({ role: 'MEMBER' }),
      );
      group.findUnique.mockResolvedValue(groupMock());
      groupMember.delete.mockResolvedValue({});

      const result = await service.leave('user_2', 'group_1');

      expect(result).toEqual({ success: true });
      expect(groupMember.delete).toHaveBeenCalledWith({ where: { id: 'gm_1' } });
    });

    it('prevents the OWNER from leaving while other members exist', async () => {
      groupMember.findUnique.mockResolvedValue(membershipMock({ role: 'OWNER' }));
      group.findUnique.mockResolvedValue(groupMock());
      groupMember.count.mockResolvedValue(4);

      await expect(service.leave('user_1', 'group_1')).rejects.toMatchObject({
        code: ErrorCode.GROUP_OWNER_CANNOT_LEAVE,
        status: HttpStatus.CONFLICT,
      });
      expect(groupMember.delete).not.toHaveBeenCalled();
      expect(group.delete).not.toHaveBeenCalled();
    });

    it('lets an OWNER leave (deleting the group) when they are the last member', async () => {
      groupMember.findUnique.mockResolvedValue(membershipMock({ role: 'OWNER' }));
      group.findUnique.mockResolvedValue(groupMock());
      groupMember.count.mockResolvedValue(1);
      transaction.mockImplementation(() => Promise.resolve([]));
      groupMember.delete.mockResolvedValue({});
      group.delete.mockResolvedValue({});

      const result = await service.leave('user_1', 'group_1');

      expect(result).toEqual({ success: true });
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(groupMember.delete).toHaveBeenCalledWith({ where: { id: 'gm_1' } });
      expect(group.delete).toHaveBeenCalledWith({ where: { id: 'group_1' } });
    });

    it('throws GROUP_NOT_MEMBER for a user not in the group', async () => {
      groupMember.findUnique.mockResolvedValue(null);

      await expect(service.leave('stranger', 'group_1')).rejects.toMatchObject({
        code: ErrorCode.GROUP_NOT_MEMBER,
      });
    });
  });

  describe('removeMember', () => {
    it('lets an OWNER remove a MEMBER', async () => {
      groupMember.findUnique
        .mockResolvedValueOnce(membershipMock({ role: 'OWNER' }))
        .mockResolvedValueOnce(membershipMock({ userId: 'u2', role: 'MEMBER', id: 'gm_2' }));
      groupMember.delete.mockResolvedValue({});

      const result = await service.removeMember('user_1', 'group_1', 'u2');

      expect(result).toEqual({ success: true });
      expect(groupMember.delete).toHaveBeenCalledWith({ where: { id: 'gm_2' } });
    });

    it('lets an ADMIN remove a MEMBER only', async () => {
      groupMember.findUnique
        .mockResolvedValueOnce(membershipMock({ role: 'ADMIN' }))
        .mockResolvedValueOnce(membershipMock({ userId: 'u3', role: 'MEMBER', id: 'gm_3' }));
      groupMember.delete.mockResolvedValue({});

      const result = await service.removeMember('user_1', 'group_1', 'u3');

      expect(result.success).toBe(true);
    });

    it('prevents an ADMIN from removing another ADMIN', async () => {
      groupMember.findUnique
        .mockResolvedValueOnce(membershipMock({ role: 'ADMIN' }))
        .mockResolvedValueOnce(membershipMock({ userId: 'u2', role: 'ADMIN', id: 'gm_2' }));

      await expect(
        service.removeMember('user_1', 'group_1', 'u2'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_ROLE_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('prevents anyone from removing the OWNER', async () => {
      groupMember.findUnique
        .mockResolvedValueOnce(membershipMock({ role: 'ADMIN' }))
        .mockResolvedValueOnce(membershipMock({ userId: 'owner', role: 'OWNER', id: 'gm_owner' }));

      await expect(
        service.removeMember('user_1', 'group_1', 'owner'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_CANNOT_REMOVE_OWNER,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('rejects a MEMBER actor', async () => {
      groupMember.findUnique.mockResolvedValue(membershipMock({ role: 'MEMBER' }));

      await expect(
        service.removeMember('user_1', 'group_1', 'u2'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_ROLE_FORBIDDEN,
      });
    });
  });

  describe('update', () => {
    it('lets the OWNER update allowed fields', async () => {
      groupMember.findUnique.mockResolvedValue(membershipMock({ role: 'OWNER' }));
      group.update.mockResolvedValue(groupMock({ name: 'Novo Nome', description: 'nova' }));
      groupMember.count.mockResolvedValue(1);

      const result = await service.update('user_1', 'group_1', {
        name: 'Novo Nome',
        description: 'nova',
      });

      expect(group.update).toHaveBeenCalledWith({
        where: { id: 'group_1' },
        data: expect.objectContaining({ name: 'Novo Nome', description: 'nova' }),
      });
      expect(result).toMatchObject({ name: 'Novo Nome' });
    });

    it('does not allow mass assignment of arbitrary fields', async () => {
      groupMember.findUnique.mockResolvedValue(membershipMock({ role: 'OWNER' }));
      group.update.mockResolvedValue(groupMock());

      const dto = { name: 'Ok', ownerId: 'hacker' } as never;
      await service.update('user_1', 'group_1', dto as never);

      expect(group.update).toHaveBeenCalledWith({
        where: { id: 'group_1' },
        data: expect.not.objectContaining({ ownerId: 'hacker' }),
      });
    });

    it('rejects non-OWNER updates with FORBIDDEN', async () => {
      groupMember.findUnique.mockResolvedValue(membershipMock({ role: 'ADMIN' }));

      await expect(
        service.update('user_1', 'group_1', { name: 'X' }),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_ROLE_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    });
  });

  describe('changeRole', () => {
    it('lets the OWNER promote a MEMBER to ADMIN', async () => {
      groupMember.findUnique
        .mockResolvedValueOnce(membershipMock({ role: 'OWNER' }))
        .mockResolvedValueOnce(membershipMock({ userId: 'u2', role: 'MEMBER', id: 'gm_2' }));
      groupMember.update.mockResolvedValue(
        membershipMock({
          userId: 'u2',
          role: 'ADMIN',
          user: { id: 'u2', name: 'Ana', username: 'ana', avatar: null },
        }),
      );

      const result = await service.changeRole('user_1', 'group_1', 'u2', 'ADMIN');

      expect(groupMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'gm_2' },
          data: { role: 'ADMIN' },
        }),
      );
      expect(result.data.role).toBe('ADMIN');
    });

    it('rejects an ADMIN actor', async () => {
      groupMember.findUnique.mockResolvedValue(membershipMock({ role: 'ADMIN' }));

      await expect(
        service.changeRole('user_1', 'group_1', 'u2', 'ADMIN'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_ROLE_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('prevents changing the OWNER role', async () => {
      groupMember.findUnique
        .mockResolvedValueOnce(membershipMock({ role: 'OWNER' }))
        .mockResolvedValueOnce(membershipMock({ userId: 'owner', role: 'OWNER', id: 'gm_owner' }));

      await expect(
        service.changeRole('user_1', 'group_1', 'owner', 'ADMIN'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_CANNOT_CHANGE_OWNER_ROLE,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('rejects demoting yourself', async () => {
      groupMember.findUnique.mockResolvedValue(membershipMock({ role: 'OWNER' }));

      await expect(
        service.changeRole('user_1', 'group_1', 'user_1', 'MEMBER'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_CANNOT_CHANGE_OWNER_ROLE,
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('throws for a member that does not exist in the group', async () => {
      groupMember.findUnique
        .mockResolvedValueOnce(membershipMock({ role: 'OWNER' }))
        .mockResolvedValueOnce(null);

      await expect(
        service.changeRole('user_1', 'group_1', 'ghost', 'ADMIN'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_NOT_MEMBER,
      });
    });
  });
});