import { PrismaService } from '../prisma/prisma.service';

import { UsersService } from './users.service';

jest.mock('@nestjs/common', () => require('../test/mock-nest-common'));

describe('UsersService', () => {
  let service: UsersService;
  let user: Record<string, jest.Mock>;

  beforeEach(() => {
    user = { findMany: jest.fn(), count: jest.fn() };
    service = new UsersService({ user } as unknown as PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns an empty result when the search term is empty', async () => {
    const result = await service.search('user_1', { q: '  ' });

    expect(user.findMany).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
  });

  it('searches active users by name or username, excluding the requester', async () => {
    user.findMany.mockResolvedValue([
      { id: 'u2', name: 'Ana Souza', username: 'ana', avatar: null },
    ]);
    user.count.mockResolvedValue(1);

    const result = await service.search('user_1', { q: 'ana', page: 1, limit: 20 });

    const where = user.findMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ not: 'user_1' });
    expect(where.status).toBe('ACTIVE');
    expect(where.OR).toEqual([
      { name: { contains: 'ana', mode: 'insensitive' } },
      { username: { contains: 'ana', mode: 'insensitive' } },
    ]);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({ id: 'u2', name: 'Ana Souza', username: 'ana', avatar: null });
  });

  it('excludes members of the given group when excludeGroupId is provided', async () => {
    user.findMany.mockResolvedValue([]);
    user.count.mockResolvedValue(0);

    await service.search('user_1', { q: 'ana', excludeGroupId: 'group_1' });

    const where = user.findMany.mock.calls[0][0].where;
    expect(where.NOT).toEqual({
      groupMemberships: { some: { groupId: 'group_1' } },
    });
  });

  it('excludes users who blocked the requester or were blocked by them', async () => {
    user.findMany.mockResolvedValue([]);
    user.count.mockResolvedValue(0);

    await service.search('user_1', { q: 'ana' });

    const where = user.findMany.mock.calls[0][0].where;
    expect(where.blockedByUsers).toEqual({ none: { blockerId: 'user_1' } });
    expect(where.blockedUsers).toEqual({ none: { blockedId: 'user_1' } });
  });

  it('paginates and returns meta', async () => {
    user.findMany.mockResolvedValue([]);
    user.count.mockResolvedValue(5);

    const result = await service.search('user_1', { q: 'ana', page: 2, limit: 2 });

    expect(user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 2, take: 2 }),
    );
    expect(result.meta).toMatchObject({
      page: 2,
      total: 5,
      totalPages: 3,
      hasNextPage: true,
    });
  });
});