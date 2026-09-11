import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ErrorCode } from '../common/errors/error-codes';

import { GroupsService } from './groups.service';
import { GroupInvitesService } from './group-invites.service';

jest.mock('@nestjs/common', () => require('../test/mock-nest-common'));

const now = new Date('2026-02-01T00:00:00Z');

const inviteMock = (overrides: Record<string, unknown> = {}) => ({
  id: 'invite_1',
  groupId: 'group_1',
  inviterId: 'user_owner',
  inviteeId: 'user_2',
  status: 'PENDING',
  expiresAt: null,
  createdAt: new Date('2026-01-30T00:00:00Z'),
  updatedAt: new Date('2026-01-30T00:00:00Z'),
  inviter: { id: 'user_owner', name: 'Dono', username: 'dono', avatar: null },
  invitee: { id: 'user_2', name: 'Ana', username: 'ana', avatar: null },
  ...overrides,
});

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('GroupInvitesService', () => {
  let service: GroupInvitesService;
  let groupsService: {
    requireMembership: jest.Mock;
    requireGroup: jest.Mock;
  };
  let groupInvite: Record<string, jest.Mock>;
  let groupMember: Record<string, jest.Mock>;
  let group: Record<string, jest.Mock>;
  let user: Record<string, jest.Mock>;
  let block: Record<string, jest.Mock>;
  let transaction: jest.Mock;
  let tx: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    groupInvite = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    groupMember = { findUnique: jest.fn(), create: jest.fn() };
    group = { findUnique: jest.fn() };
    user = { findUnique: jest.fn() };
    block = { findFirst: jest.fn() };

    tx = {
      groupInvite: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      groupMember: { findUnique: jest.fn(), create: jest.fn() },
      group: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      block: { findFirst: jest.fn() },
    };

    transaction = jest.fn(async (fn: unknown) =>
      (fn as (t: typeof tx) => unknown)(tx),
    );

    const prisma = {
      groupInvite,
      groupMember,
      group,
      user,
      block,
      $transaction: transaction,
    };

    groupsService = {
      requireMembership: jest.fn().mockResolvedValue({
        id: 'gm_owner',
        groupId: 'group_1',
        userId: 'user_owner',
        role: 'OWNER',
        joinedAt: now,
      }),
      requireGroup: jest.fn().mockResolvedValue({ id: 'group_1' }),
    };

    service = new GroupInvitesService(
      prisma as unknown as PrismaService,
      groupsService as unknown as GroupsService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('lets an OWNER invite users as PENDING', async () => {
      tx.user.findUnique.mockResolvedValue({
        id: 'user_2',
        name: 'Ana',
        username: 'ana',
        avatar: null,
        status: 'ACTIVE',
      });
      tx.groupMember.findUnique.mockResolvedValue(null);
      tx.block.findFirst.mockResolvedValue(null);
      tx.groupInvite.findFirst.mockResolvedValue(null);
      tx.groupInvite.create.mockResolvedValue(inviteMock());

      const result = await service.create('user_owner', 'group_1', {
        userIds: ['user_2'],
      });

      expect(tx.groupInvite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            groupId: 'group_1',
            inviterId: 'user_owner',
            inviteeId: 'user_2',
            status: 'PENDING',
          }),
        }),
      );
      expect(result.failed).toHaveLength(0);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'invite_1',
        status: 'PENDING',
        inviter: { userId: 'user_owner' },
        invitee: { userId: 'user_2' },
      });
    });

    it('lets an ADMIN invite users', async () => {
      groupsService.requireMembership.mockResolvedValue({
        id: 'gm_adm',
        groupId: 'group_1',
        userId: 'user_admin',
        role: 'ADMIN',
        joinedAt: now,
      });
      tx.user.findUnique.mockResolvedValue({
        id: 'user_2',
        name: 'Ana',
        username: 'ana',
        avatar: null,
        status: 'ACTIVE',
      });
      tx.groupMember.findUnique.mockResolvedValue(null);
      tx.block.findFirst.mockResolvedValue(null);
      tx.groupInvite.findFirst.mockResolvedValue(null);
      tx.groupInvite.create.mockResolvedValue(inviteMock({ id: 'invite_2' }));

      const result = await service.create('user_admin', 'group_1', {
        userIds: ['user_2'],
      });

      expect(result.data).toHaveLength(1);
      expect(tx.groupInvite.create).toHaveBeenCalled();
    });

    it('forbids a MEMBER from inviting', async () => {
      groupsService.requireMembership.mockResolvedValue({
        id: 'gm_member',
        groupId: 'group_1',
        userId: 'user_3',
        role: 'MEMBER',
        joinedAt: now,
      });

      await expect(
        service.create('user_3', 'group_1', { userIds: ['user_2'] }),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_ROLE_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('reports inviting yourself as failed', async () => {
      const result = await service.create('user_owner', 'group_1', {
        userIds: ['user_owner'],
      });

      expect(result.data).toHaveLength(0);
      expect(result.failed).toEqual([
        expect.objectContaining({
          userId: 'user_owner',
          code: ErrorCode.GROUP_INVITE_SELF,
        }),
      ]);
      expect(tx.groupInvite.create).not.toHaveBeenCalled();
    });

    it('reports inviting an existing member as failed', async () => {
      tx.user.findUnique.mockResolvedValue({
        id: 'user_2',
        name: 'Ana',
        username: 'ana',
        avatar: null,
        status: 'ACTIVE',
      });
      tx.groupMember.findUnique.mockResolvedValue({ id: 'gm_2' });

      const result = await service.create('user_owner', 'group_1', {
        userIds: ['user_2'],
      });

      expect(result.failed).toEqual([
        expect.objectContaining({
          userId: 'user_2',
          code: ErrorCode.GROUP_ALREADY_MEMBER,
        }),
      ]);
    });

    it('reports a duplicate PENDING invite as failed', async () => {
      tx.user.findUnique.mockResolvedValue({
        id: 'user_2',
        name: 'Ana',
        username: 'ana',
        avatar: null,
        status: 'ACTIVE',
      });
      tx.groupMember.findUnique.mockResolvedValue(null);
      tx.block.findFirst.mockResolvedValue(null);
      tx.groupInvite.findFirst.mockResolvedValue(null);
      tx.groupInvite.create.mockRejectedValue(p2002());

      const result = await service.create('user_owner', 'group_1', {
        userIds: ['user_2'],
      });

      expect(result.failed).toEqual([
        expect.objectContaining({
          userId: 'user_2',
          code: ErrorCode.GROUP_INVITE_DUPLICATE,
        }),
      ]);
    });

    it('reactivates a REJECTED invite instead of creating a new one', async () => {
      tx.user.findUnique.mockResolvedValue({
        id: 'user_2',
        name: 'Ana',
        username: 'ana',
        avatar: null,
        status: 'ACTIVE',
      });
      tx.groupMember.findUnique.mockResolvedValue(null);
      tx.block.findFirst.mockResolvedValue(null);
      tx.groupInvite.findFirst.mockResolvedValue(
        inviteMock({ status: 'REJECTED' }),
      );
      tx.groupInvite.update.mockResolvedValue(inviteMock({ id: 'invite_old' }));

      const result = await service.create('user_owner', 'group_1', {
        userIds: ['user_2'],
      });

      expect(tx.groupInvite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'invite_1' },
          data: { status: 'PENDING', inviterId: 'user_owner' },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(tx.groupInvite.create).not.toHaveBeenCalled();
    });

    it('reports inviting a user that is blocked as failed', async () => {
      tx.user.findUnique.mockResolvedValue({
        id: 'user_2',
        name: 'Ana',
        username: 'ana',
        avatar: null,
        status: 'ACTIVE',
      });
      tx.groupMember.findUnique.mockResolvedValue(null);
      tx.block.findFirst.mockResolvedValue({ id: 'b1' });

      const result = await service.create('user_owner', 'group_1', {
        userIds: ['user_2'],
      });

      expect(result.failed).toEqual([
        expect.objectContaining({
          userId: 'user_2',
          code: ErrorCode.GROUP_INVITE_BLOCKED,
        }),
      ]);
    });

    it('reports an inactive target as failed', async () => {
      tx.user.findUnique.mockResolvedValue({
        id: 'user_2',
        name: 'Ana',
        username: 'ana',
        avatar: null,
        status: 'BLOCKED',
      });

      const result = await service.create('user_owner', 'group_1', {
        userIds: ['user_2'],
      });

      expect(result.failed).toEqual([
        expect.objectContaining({
          userId: 'user_2',
          code: ErrorCode.GROUP_INVITE_TARGET_UNAVAILABLE,
        }),
      ]);
    });

    it('deduplicates repeated ids in the payload', async () => {
      tx.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
        if (args.where.id === 'user_3') return Promise.resolve(null);
        return Promise.resolve({
          id: 'user_2',
          name: 'Ana',
          username: 'ana',
          avatar: null,
          status: 'ACTIVE',
        });
      });
      tx.groupMember.findUnique.mockResolvedValue(null);
      tx.block.findFirst.mockResolvedValue(null);
      tx.groupInvite.findFirst.mockResolvedValue(null);
      tx.groupInvite.create.mockResolvedValue(inviteMock());

      const result = await service.create('user_owner', 'group_1', {
        userIds: ['user_2', 'user_2', 'user_3'],
      });

      expect(result.data).toHaveLength(1);
      expect(result.failed).toEqual([
        expect.objectContaining({
          userId: 'user_3',
          code: ErrorCode.GROUP_INVITE_TARGET_UNAVAILABLE,
        }),
      ]);
      expect(tx.groupInvite.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findReceived', () => {
    it('returns only PENDING invites for the user with group and inviter info', async () => {
      groupInvite.findMany.mockResolvedValue([
        inviteMock({
          group: { _count: { members: 7 }, name: 'Bloco da Folia', avatar: null },
        }),
      ]);
      groupInvite.count.mockResolvedValue(1);

      const result = await service.findReceived('user_2', { page: 1, limit: 20 });

      expect(groupInvite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { inviteeId: 'user_2', status: 'PENDING' },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'invite_1',
        status: 'PENDING',
        group: { groupId: 'group_1', memberCount: 7 },
        inviter: { userId: 'user_owner' },
      });
      expect(result.meta.total).toBe(1);
    });

    it('marks invites past expiresAt as EXPIRED', async () => {
      groupInvite.findMany.mockResolvedValue([
        inviteMock({
          expiresAt: new Date('2026-01-01T00:00:00Z'),
          group: { _count: { members: 1 }, name: 'Bloco da Folia', avatar: null },
        }),
      ]);
      groupInvite.count.mockResolvedValue(1);

      const result = await service.findReceived('user_2', { page: 1, limit: 20 });

      expect(result.data[0].status).toBe('EXPIRED');
    });
  });

  describe('findSent', () => {
    it('returns all invites sent by the user without accepting an inviterId param', async () => {
      groupInvite.findMany.mockResolvedValue([
        inviteMock({
          group: { id: 'group_1', name: 'Bloco da Folia', avatar: null },
        }),
      ]);
      groupInvite.count.mockResolvedValue(1);

      const result = await service.findSent('user_owner', { page: 1, limit: 20 });

      expect(groupInvite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            inviterId: 'user_owner',
            status: {
              in: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
            },
          },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'invite_1',
        status: 'PENDING',
        group: { groupId: 'group_1', name: 'Bloco da Folia' },
        invitee: { userId: 'user_2' },
      });
      expect(result.meta.total).toBe(1);
    });

    it('does not use a user-supplied inviterId from the query', async () => {
      groupInvite.findMany.mockResolvedValue([]);
      groupInvite.count.mockResolvedValue(0);

      await service.findSent('user_owner', {
        inviterId: 'user_hacker',
      } as never);

      expect(groupInvite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            inviterId: 'user_owner',
          }),
        }),
      );
    });
  });

  describe('listPending', () => {
    it('lets an OWNER list pending invites', async () => {
      groupInvite.findMany.mockResolvedValue([inviteMock()]);

      const result = await service.listPending('user_owner', 'group_1');

      expect(groupInvite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId: 'group_1', status: 'PENDING' },
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('forbids a MEMBER from listing pending invites', async () => {
      groupsService.requireMembership.mockResolvedValue({
        id: 'gm_member',
        groupId: 'group_1',
        userId: 'user_3',
        role: 'MEMBER',
        joinedAt: now,
      });

      await expect(
        service.listPending('user_3', 'group_1'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_ROLE_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    });
  });

  describe('accept', () => {
    it('accepts a PENDING invite and creates a GroupMember atomically', async () => {
      tx.groupInvite.findUnique.mockResolvedValue(inviteMock());
      tx.group.findUnique.mockResolvedValue({ id: 'group_1' });
      tx.groupMember.findUnique.mockResolvedValue(null);
      tx.groupMember.create.mockResolvedValue({ id: 'gm_new' });
      tx.groupInvite.update.mockResolvedValue(
        inviteMock({ status: 'ACCEPTED' }),
      );

      const result = await service.accept('user_2', 'invite_1');

      expect(result).toEqual({ success: true, groupId: 'group_1' });
      expect(tx.groupMember.create).toHaveBeenCalledWith({
        data: { groupId: 'group_1', userId: 'user_2', role: 'MEMBER' },
      });
      expect(tx.groupInvite.update).toHaveBeenCalledWith({
        where: { id: 'invite_1' },
        data: { status: 'ACCEPTED' },
      });
      expect(groupsService.requireMembership).not.toHaveBeenCalled();
    });

    it('clears previous ACCEPTED history rows before accepting a new invitation', async () => {
      tx.groupInvite.findUnique.mockResolvedValue(inviteMock({ id: 'invite_2' }));
      tx.group.findUnique.mockResolvedValue({ id: 'group_1' });
      tx.groupMember.findUnique.mockResolvedValue(null);
      tx.groupMember.create.mockResolvedValue({ id: 'gm_new' });
      tx.groupInvite.update.mockResolvedValue(
        inviteMock({ id: 'invite_2', status: 'ACCEPTED' }),
      );

      await service.accept('user_2', 'invite_2');

      expect(tx.groupInvite.deleteMany).toHaveBeenCalledWith({
        where: {
          groupId: 'group_1',
          inviteeId: 'user_2',
          status: 'ACCEPTED',
        },
      });
    });

    it('forbids a user who is not the invitee', async () => {
      tx.groupInvite.findUnique.mockResolvedValue(inviteMock());

      await expect(service.accept('user_other', 'invite_1')).rejects.toMatchObject(
        {
          code: ErrorCode.GROUP_INVITE_FORBIDDEN,
          status: HttpStatus.FORBIDDEN,
        },
      );
      expect(tx.groupMember.create).not.toHaveBeenCalled();
    });

    it('forbids accepting an invite that is not PENDING', async () => {
      tx.groupInvite.findUnique.mockResolvedValue(
        inviteMock({ status: 'CANCELLED' }),
      );

      await expect(service.accept('user_2', 'invite_1')).rejects.toMatchObject({
        code: ErrorCode.GROUP_INVITE_NOT_PENDING,
        status: HttpStatus.CONFLICT,
      });
    });

    it('forbids accepting an expired invite', async () => {
      tx.groupInvite.findUnique.mockResolvedValue(
        inviteMock({ expiresAt: new Date('2026-01-01T00:00:00Z') }),
      );

      await expect(service.accept('user_2', 'invite_1')).rejects.toMatchObject({
        code: ErrorCode.GROUP_INVITE_EXPIRED,
        status: HttpStatus.CONFLICT,
      });
    });

    it('forbids accepting when the user already belongs to the group', async () => {
      tx.groupInvite.findUnique.mockResolvedValue(inviteMock());
      tx.group.findUnique.mockResolvedValue({ id: 'group_1' });
      tx.groupMember.findUnique.mockResolvedValue({ id: 'gm_existing' });

      await expect(service.accept('user_2', 'invite_1')).rejects.toMatchObject({
        code: ErrorCode.GROUP_ALREADY_MEMBER,
        status: HttpStatus.CONFLICT,
      });
      expect(tx.groupMember.create).not.toHaveBeenCalled();
    });

    it('forbids accepting an invite of a deleted group', async () => {
      tx.groupInvite.findUnique.mockResolvedValue(inviteMock());
      tx.group.findUnique.mockResolvedValue(null);

      await expect(service.accept('user_2', 'invite_1')).rejects.toMatchObject({
        code: ErrorCode.GROUP_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('fails with NOT_FOUND when the invite does not exist', async () => {
      tx.groupInvite.findUnique.mockResolvedValue(null);

      await expect(service.accept('user_2', 'ghost')).rejects.toMatchObject({
        code: ErrorCode.GROUP_INVITE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('reject', () => {
    it('marks a PENDING invite as REJECTED', async () => {
      groupInvite.findUnique.mockResolvedValue(inviteMock());
      groupInvite.update.mockResolvedValue(inviteMock({ status: 'REJECTED' }));
      groupMember.create.mockResolvedValue(undefined);

      const result = await service.reject('user_2', 'invite_1');

      expect(result).toEqual({ success: true });
      expect(groupInvite.update).toHaveBeenCalledWith({
        where: { id: 'invite_1' },
        data: { status: 'REJECTED' },
      });
      expect(groupMember.create).not.toHaveBeenCalled();
    });

    it('forbids rejecting someone elses invite', async () => {
      groupInvite.findUnique.mockResolvedValue(inviteMock());

      await expect(service.reject('user_other', 'invite_1')).rejects.toMatchObject(
        {
          code: ErrorCode.GROUP_INVITE_FORBIDDEN,
        },
      );
    });

    it('forbids rejecting an invite that is not PENDING', async () => {
      groupInvite.findUnique.mockResolvedValue(
        inviteMock({ status: 'ACCEPTED' }),
      );

      await expect(service.reject('user_2', 'invite_1')).rejects.toMatchObject({
        code: ErrorCode.GROUP_INVITE_NOT_PENDING,
        status: HttpStatus.CONFLICT,
      });
    });
  });

  describe('cancel', () => {
    it('lets an OWNER cancel a PENDING invite', async () => {
      groupInvite.findFirst.mockResolvedValue(inviteMock());
      groupInvite.update.mockResolvedValue(inviteMock({ status: 'CANCELLED' }));

      const result = await service.cancel('user_owner', 'group_1', 'invite_1');

      expect(result).toEqual({ success: true });
      expect(groupInvite.update).toHaveBeenCalledWith({
        where: { id: 'invite_1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('lets an ADMIN cancel a PENDING invite', async () => {
      groupsService.requireMembership.mockResolvedValue({
        id: 'gm_adm',
        groupId: 'group_1',
        userId: 'user_admin',
        role: 'ADMIN',
        joinedAt: now,
      });
      groupInvite.findFirst.mockResolvedValue(inviteMock());
      groupInvite.update.mockResolvedValue(inviteMock({ status: 'CANCELLED' }));

      const result = await service.cancel('user_admin', 'group_1', 'invite_1');

      expect(result).toEqual({ success: true });
    });

    it('lets a MEMBER cancel only their own invite', async () => {
      groupsService.requireMembership.mockResolvedValue({
        id: 'gm_member',
        groupId: 'group_1',
        userId: 'user_owner',
        role: 'MEMBER',
        joinedAt: now,
      });
      groupInvite.findFirst.mockResolvedValue(inviteMock());

      const result = await service.cancel('user_owner', 'group_1', 'invite_1');

      expect(result).toEqual({ success: true });
    });

    it('forbids a MEMBER from cancelling someone elses invite', async () => {
      groupsService.requireMembership.mockResolvedValue({
        id: 'gm_member',
        groupId: 'group_1',
        userId: 'user_4',
        role: 'MEMBER',
        joinedAt: now,
      });
      groupInvite.findFirst.mockResolvedValue(inviteMock());

      await expect(
        service.cancel('user_4', 'group_1', 'invite_1'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_INVITE_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('forbids cancelling an invite that is not PENDING', async () => {
      groupInvite.findFirst.mockResolvedValue(
        inviteMock({ status: 'ACCEPTED' }),
      );

      await expect(
        service.cancel('user_owner', 'group_1', 'invite_1'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_INVITE_NOT_PENDING,
        status: HttpStatus.CONFLICT,
      });
    });

    it('fails with NOT_FOUND when the invite does not exist in the group', async () => {
      groupInvite.findFirst.mockResolvedValue(null);

      await expect(
        service.cancel('user_owner', 'group_1', 'ghost'),
      ).rejects.toMatchObject({
        code: ErrorCode.GROUP_INVITE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('forbids cancelling without being a member of the group', async () => {
      groupsService.requireMembership.mockRejectedValue({
        code: ErrorCode.GROUP_NOT_MEMBER,
        status: HttpStatus.NOT_FOUND,
      });

      await expect(
        service.cancel('stranger', 'group_1', 'invite_1'),
      ).rejects.toMatchObject({ code: ErrorCode.GROUP_NOT_MEMBER });
    });
  });
});