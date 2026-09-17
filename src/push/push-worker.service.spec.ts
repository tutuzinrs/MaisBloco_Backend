import { PushWorkerService, pushMessage } from './push-worker.service';
import { PushTransportError } from './expo-push.service';
jest.mock('@nestjs/common', () => require('../test/mock-nest-common'));
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

function setup(overrides: Record<string, unknown> = {}) {
  const job = {
    id: 1,
    notificationId: 2,
    deviceId: 'device',
    deviceVersion: 1,
    token: 'ExpoPushToken[abcdefghij]',
    status: 'PENDING',
    attempts: 0,
    receiptAttempts: 0,
    createdAt: new Date(),
    ticketId: null,
    device: {
      active: true,
      userId: 3,
      version: 1,
      token: 'ExpoPushToken[abcdefghij]',
    },
    notification: {
      userId: 3,
      title: 'Convite',
      body: 'Você recebeu um convite',
      data: { type: 'GROUP_INVITE', groupId: 4 },
    },
    ...overrides,
  };
  const db = {
    pushDelivery: {
      findMany: jest.fn().mockResolvedValue([job]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(job),
    },
    pushDevice: { updateMany: jest.fn() },
  };
  const expo = {
    send: jest.fn().mockResolvedValue({ status: 'ok', id: 'ticket' }),
    receipt: jest.fn().mockResolvedValue({ status: 'ok' }),
  };
  const worker = new PushWorkerService(
    db as never,
    expo as never,
    { get: () => 'false' } as never,
  );
  return { job, db, expo, worker };
}
describe('persistent push worker', () => {
  it('sends a visible notification and stores its ticket for later receipt checking', async () => {
    const { worker, expo, db } = setup();
    await worker.tick();
    expect(expo.send).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Convite',
        sound: 'default',
        priority: 'high',
        channelId: 'notifications',
        data: {
          notificationId: 2,
          recipientId: 3,
          type: 'GROUP_INVITE',
          groupId: 4,
        },
      }),
    );
    expect(db.pushDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RECEIPT',
          ticketId: 'ticket',
          claimId: null,
        }),
      }),
    );
  });
  it('skips a row claimed by another worker', async () => {
    const { worker, expo, db } = setup();
    db.pushDelivery.updateMany.mockResolvedValue({ count: 0 });
    await worker.tick();
    expect(expo.send).not.toHaveBeenCalled();
  });
  it.each([
    { active: false },
    { userId: 9 },
    { version: 2 },
    { token: 'rotated-token' },
  ])(
    'cancels stale delivery after logout or token/account changes: %j',
    async (change) => {
      const { job, worker, expo, db } = setup();
      Object.assign(job.device, change);
      await worker.tick();
      expect(expo.send).not.toHaveBeenCalled();
      expect(db.pushDelivery.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    },
  );
  it.each(['PENDING', 'RECEIPT'])(
    'deactivates invalid tokens reported by %s',
    async (status) => {
      const { worker, expo, db } = setup({ status, ticketId: 'ticket' });
      expo.send.mockResolvedValue({
        status: 'error',
        details: { error: 'DeviceNotRegistered' },
      } as never);
      expo.receipt.mockResolvedValue({
        status: 'error',
        details: { error: 'DeviceNotRegistered' },
      } as never);
      await worker.tick();
      expect(db.pushDevice.updateMany).toHaveBeenCalledWith({
        where: { id: 'device', token: 'ExpoPushToken[abcdefghij]', version: 1 },
        data: { active: false },
      });
    },
  );
  it('checks a receipt without sending the notification again', async () => {
    const { worker, expo, db } = setup({
      status: 'RECEIPT',
      ticketId: 'ticket',
    });
    await worker.tick();
    expect(expo.send).not.toHaveBeenCalled();
    expect(expo.receipt).toHaveBeenCalledWith('ticket');
    expect(db.pushDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DONE' }),
      }),
    );
  });
  it('keeps missing receipts pending without resending', async () => {
    const { worker, expo, db } = setup({
      status: 'RECEIPT',
      ticketId: 'ticket',
    });
    expo.receipt.mockResolvedValue(undefined as never);
    await worker.tick();
    expect(expo.send).not.toHaveBeenCalled();
    expect(db.pushDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ receiptAttempts: { increment: 1 } }),
      }),
    );
  });
  it('retries transient failures with backoff', async () => {
    const { worker, expo, db } = setup();
    expo.send.mockRejectedValue(new PushTransportError('HTTP_429', true));
    await worker.tick();
    expect(db.pushDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          attempts: 1,
          lastError: 'HTTP_429',
        }),
      }),
    );
  });
  it('does not invalidate a device for a credentials problem', async () => {
    const { worker, expo, db } = setup();
    expo.send.mockResolvedValue({
      status: 'error',
      details: { error: 'InvalidCredentials' },
    } as never);
    await worker.tick();
    expect(db.pushDevice.updateMany).not.toHaveBeenCalled();
    expect(db.pushDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          lastError: 'InvalidCredentials',
        }),
      }),
    );
  });
  it('expires old jobs instead of replaying old notifications', async () => {
    const { worker, expo } = setup({
      createdAt: new Date(Date.now() - 86_400_001),
    });
    await worker.tick();
    expect(expo.send).not.toHaveBeenCalled();
  });
  it('bounds payload size and excludes arbitrary content', () => {
    const { job } = setup();
    job.notification.body = '🎉'.repeat(10_000);
    job.notification.data = {
      type: 'FUTURE_TYPE',
      groupId: 4,
      avatar: 'a'.repeat(10_000),
    } as never;
    const message = pushMessage(job as never);
    expect(Buffer.byteLength(JSON.stringify(message))).toBeLessThan(4096);
    expect(message.data).not.toHaveProperty('avatar');
    expect(message.data.type).toBe('FUTURE_TYPE');
  });
});
