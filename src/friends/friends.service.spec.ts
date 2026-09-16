import { FriendsService } from './friends.service';
import { PrismaService } from '../prisma/prisma.service';
jest.mock('@nestjs/common', () => require('../test/mock-nest-common'));
describe('FriendsService permissions', () => {
  const tx = {
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
    block: { findFirst: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
    friendship: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
  };
  let service: FriendsService;
  beforeEach(() => {
    jest.resetAllMocks();
    service = new FriendsService({
      ...tx,
      $transaction: (work: (client: typeof tx) => unknown) => work(tx),
    } as unknown as PrismaService, { create: jest.fn() } as never);
  });
  it('rejects an attempt to accept another user request', async () => {
    tx.friendship.findFirst.mockResolvedValue(null);
    await expect(
      service.respond('intruder', 'request', 'accept'),
    ).rejects.toMatchObject({ status: 404 });
    expect(tx.friendship.findFirst).toHaveBeenCalledWith({
      where: { id: 'request', receiverId: 'intruder', status: 'PENDING' },
    });
    expect(tx.friendship.update).not.toHaveBeenCalled();
  });
  it('prevents requests across a block in either direction', async () => {
    tx.user.findFirst.mockResolvedValue({ id: 'target' });
    tx.block.findFirst.mockResolvedValue({ id: 'block' });
    await expect(service.request('me', 'target')).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.friendship.create).not.toHaveBeenCalled();
  });
  it('does not create a duplicate reverse friendship', async () => {
    tx.user.findFirst.mockResolvedValue({ id: 'target' });
    tx.block.findFirst.mockResolvedValue(null);
    tx.friendship.findFirst.mockResolvedValue({
      requesterId: 'target',
      receiverId: 'me',
    });
    await expect(service.request('me', 'target')).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.friendship.create).not.toHaveBeenCalled();
  });
  it('blocking removes the pair relationship atomically', async () => {
    tx.user.findUnique.mockResolvedValue({ id: 'target' });
    await service.block('me', 'target');
    expect(tx.block.upsert).toHaveBeenCalled();
    expect(tx.friendship.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { requesterId: 'me', receiverId: 'target' },
          { requesterId: 'target', receiverId: 'me' },
        ],
      },
    });
  });
  it('unblocking cannot remove someone else block', async () => {
    await service.unblock('me', 'target');
    expect(tx.block.deleteMany).toHaveBeenCalledWith({
      where: { blockerId: 'me', blockedId: 'target' },
    });
    expect(tx.friendship.create).not.toHaveBeenCalled();
  });
  it('cannot remove an unrelated friendship', async () => {
    tx.friendship.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove('me', 'other')).rejects.toMatchObject({
      status: 404,
    });
  });
});
