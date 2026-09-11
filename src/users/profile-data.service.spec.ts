import { UserEventsService } from './user-events.service';
import { UserPreferencesService } from './user-preferences.service';
import { PrismaService } from '../prisma/prisma.service';
jest.mock('@nestjs/common', () => require('../test/mock-nest-common'));
describe('Profile data ownership', () => {
  it('scopes favorite and participation removals to the authenticated user', async () => {
    const db = {
      favorite: { deleteMany: jest.fn() },
      eventParticipant: { deleteMany: jest.fn() },
    };
    const service = new UserEventsService(db as unknown as PrismaService);
    await service.removeFavorite('me', 'event');
    await service.cancelParticipation('me', 'event');
    expect(db.favorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'me', eventId: 'event' },
    });
    expect(db.eventParticipant.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'me', eventId: 'event' },
    });
  });
  it('persists privacy without writing coordinates', async () => {
    const db = { user: { update: jest.fn() }, location: { upsert: jest.fn() } };
    await new UserPreferencesService(
      db as unknown as PrismaService,
    ).updatePrivacy('me', { locationSharingLevel: 'FRIENDS' });
    expect(db.user.update.mock.calls[0][0].data).toEqual({
      locationSharingLevel: 'FRIENDS',
    });
    expect(db.location.upsert).not.toHaveBeenCalled();
  });
  it('writes preferences to the current user, including false values', async () => {
    const upsert = jest.fn();
    await new UserPreferencesService({
      notificationPreferences: { upsert },
    } as unknown as PrismaService).updateNotifications('me', {
      messages: false,
    });
    expect(upsert.mock.calls[0][0]).toMatchObject({
      where: { userId: 'me' },
      create: { userId: 'me', messages: false },
      update: { messages: false },
    });
  });
});

describe('My event filters', () => {
  it('keeps future events without endAt eligible for confirmed participation', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new UserEventsService({
      event: { findMany, count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService);
    await service.list('me', { filter: 'confirmed', page: 1, limit: 20 });
    const where = findMany.mock.calls[0][0].where;
    expect(where.participants).toEqual({ some: { userId: 'me' } });
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endAt: null,
          startAt: { gte: expect.any(Date) },
        }),
      ]),
    );
    expect(where).not.toHaveProperty('NOT');
  });
});
