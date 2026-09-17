import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { ExpoPushService, ExpoResult } from '../src/push/expo-push.service';
import { PushWorkerService } from '../src/push/push-worker.service';

const device = () => ({
  deviceId: randomUUID(),
  secret: 'a'.repeat(64),
  platform: 'android',
  token: `ExpoPushToken[${randomUUID().replaceAll('-', '')}]`,
});

describe('Push API and transactional outbox (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let notifications: NotificationsService;
  let users: number[];
  let auth: string[];
  const expo = {
    send: jest.fn<() => Promise<ExpoResult>>(),
    receipt: jest.fn<() => Promise<ExpoResult | undefined>>(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ExpoPushService)
      .useValue(expo)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    db = app.get(PrismaService);
    notifications = app.get(NotificationsService);
    users = [];
    for (let i = 0; i < 2; i++) {
      const suffix = randomUUID();
      const user = await db.user.create({
        data: {
          name: 'Push test',
          username: `push-${suffix}`,
          email: `push-${suffix}@example.invalid`,
        },
      });
      users.push(user.id);
    }
    auth = users.map((sub) => `Bearer ${app.get(JwtService).sign({ sub })}`);
  });
  beforeEach(async () => {
    await db.notification.deleteMany({ where: { userId: { in: users } } });
    await db.pushDevice.deleteMany({ where: { userId: { in: users } } });
    await db.notificationPreferences.deleteMany({
      where: { userId: { in: users } },
    });
    expo.send
      .mockReset()
      .mockResolvedValue({ status: 'ok', id: 'test-ticket' });
    expo.receipt.mockReset().mockResolvedValue({ status: 'ok' });
  });
  afterAll(async () => {
    if (db && users) await db.user.deleteMany({ where: { id: { in: users } } });
    await app?.close();
  });
  const register = (data: ReturnType<typeof device>, account = 0) =>
    request(app.getHttpServer())
      .post('/push/devices')
      .set('Authorization', auth[account])
      .send(data);
  const notify = (type = 'GROUP_INVITE') =>
    notifications.create(db, {
      userId: users[0],
      category: 'groupInvites',
      title: 'Aviso',
      body: 'Mensagem de teste',
      data: { type, groupId: 5 },
    });

  it('requires authentication and validates token/device payloads', async () => {
    await request(app.getHttpServer())
      .post('/push/devices')
      .send(device())
      .expect(401);
    await register({ ...device(), token: 'not-an-expo-token' }).expect(400);
    await request(app.getHttpServer())
      .post('/push/devices')
      .set('Authorization', auth[0])
      .send({ ...device(), userId: users[1] })
      .expect(400);
  });
  it('stores devices separately, keeps raw revocation secrets out of the database, and registers idempotently', async () => {
    const first = device();
    await register(first).expect(201);
    await register(first).expect(201);
    await register({ ...device(), platform: 'ios' }).expect(201);
    expect(await db.pushDevice.count({ where: { userId: users[0] } })).toBe(2);
    const stored = await db.pushDevice.findUniqueOrThrow({
      where: { id: first.deviceId },
    });
    expect(stored.secretHash).not.toBe(first.secret);
    expect(stored.version).toBe(1);
  });
  it('queues every generated notification type for each active device, without changing the inbox', async () => {
    await register(device()).expect(201);
    await register(device()).expect(201);
    const types = [
      'FRIEND_REQUEST',
      'FRIEND_ACCEPTED',
      'FRIEND_REJECTED',
      'GROUP_INVITE',
      'GROUP_INVITE_ACCEPTED',
      'GROUP_INVITE_REJECTED',
      'GROUP_INVITE_CANCELLED',
      'GROUP_MEMBER_ADDED',
      'GROUP_MEMBER_JOINED',
      'GROUP_MEMBER_LEFT',
      'GROUP_MEMBER_REMOVED',
      'GROUP_ROLE_CHANGED',
      'GROUP_UPDATED',
      'FUTURE_TYPE',
    ];
    for (const type of types) await notify(type);
    expect(
      await db.notification.count({ where: { userId: users[0], read: false } }),
    ).toBe(types.length);
    expect(
      await db.pushDelivery.count({
        where: { notification: { userId: users[0] } },
      }),
    ).toBe(types.length * 2);
  });
  it('rolls back the inbox notification and push jobs together', async () => {
    await register(device()).expect(201);
    await expect(
      db.$transaction(async (tx) => {
        await notifications.create(tx, {
          userId: users[0],
          category: 'groupInvites',
          title: 'Rollback',
          body: 'Not sent',
        });
        throw Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await db.notification.count({ where: { userId: users[0] } })).toBe(
      0,
    );
    expect(
      await db.pushDelivery.count({ where: { device: { userId: users[0] } } }),
    ).toBe(0);
  });
  it('respects existing notification preferences', async () => {
    await register(device()).expect(201);
    await db.notificationPreferences.create({
      data: { userId: users[0], groupInvites: false },
    });
    await notify();
    expect(
      await db.pushDelivery.count({ where: { device: { userId: users[0] } } }),
    ).toBe(0);
  });
  it('cannot revoke or overwrite another installation without its secret', async () => {
    const first = device();
    await register(first).expect(201);
    await register({ ...first, secret: 'b'.repeat(64) }, 1).expect(403);
    await request(app.getHttpServer())
      .post('/push/devices/revoke')
      .send({ deviceId: first.deviceId, secret: 'b'.repeat(64) })
      .expect(201);
    expect(
      (await db.pushDevice.findUniqueOrThrow({ where: { id: first.deviceId } }))
        .active,
    ).toBe(true);
  });
  it('revokes the device after JWT expiry using its revocation capability', async () => {
    const first = device();
    await register(first).expect(201);
    await request(app.getHttpServer())
      .post('/push/devices/revoke')
      .send({ deviceId: first.deviceId, secret: first.secret })
      .expect(201);
    await notify();
    expect(
      await db.pushDelivery.count({ where: { deviceId: first.deviceId } }),
    ).toBe(0);
  });
  it('cancels queued notifications when the installation moves to another account', async () => {
    const first = device();
    await register(first).expect(201);
    await notify();
    await register(first, 1).expect(201);
    await app.get(PushWorkerService).tick();
    expect(expo.send).not.toHaveBeenCalled();
    expect(
      (
        await db.pushDelivery.findFirstOrThrow({
          where: { deviceId: first.deviceId },
        })
      ).status,
    ).toBe('CANCELLED');
  });
  it('concurrent workers claim a job once, and receipts deactivate invalid tokens', async () => {
    const first = device();
    await register(first).expect(201);
    await notify();
    const other = new PushWorkerService(
      db,
      expo as unknown as ExpoPushService,
      app.get(ConfigService),
    );
    await Promise.all([app.get(PushWorkerService).tick(), other.tick()]);
    expect(expo.send).toHaveBeenCalledTimes(1);
    let job = await db.pushDelivery.findFirstOrThrow({
      where: { deviceId: first.deviceId },
    });
    expect(job.status).toBe('RECEIPT');
    await db.pushDelivery.update({
      where: { id: job.id },
      data: { nextAttemptAt: new Date(0) },
    });
    expo.receipt.mockResolvedValue({
      status: 'error',
      details: { error: 'DeviceNotRegistered' },
    });
    await other.tick();
    expect(expo.send).toHaveBeenCalledTimes(1);
    expect(
      (await db.pushDevice.findUniqueOrThrow({ where: { id: first.deviceId } }))
        .active,
    ).toBe(false);
    job = await db.pushDelivery.findUniqueOrThrow({ where: { id: job.id } });
    expect(job.status).toBe('CANCELLED');
  });
});
