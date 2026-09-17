import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Prisma, PushDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExpoPushService,
  PushMessage,
  PushTransportError,
} from './expo-push.service';

type Delivery = Prisma.PushDeliveryGetPayload<{
  include: { notification: true; device: true };
}>;
const DAY = 86_400_000;

export function pushMessage(job: Delivery): PushMessage {
  const source = job.notification.data;
  const data: Record<string, string | number> = {
    notificationId: job.notificationId,
    recipientId: job.notification.userId,
  };
  // Only copy routing fields; actor avatars and arbitrary text can exceed APNs' 4 KiB.
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const key of ['type', 'groupId', 'inviteId', 'friendshipId']) {
      const value = source[key];
      if (
        typeof value === 'number' ||
        (typeof value === 'string' && value.length <= 100)
      )
        data[key] = value;
    }
  }
  return {
    to: job.token,
    title: [...job.notification.title].slice(0, 100).join(''),
    body: [...job.notification.body].slice(0, 400).join(''),
    data,
    sound: 'default',
    channelId: 'notifications',
    priority: 'high',
    ttl: 86_400,
  };
}

@Injectable()
export class PushWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushWorkerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopping = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly expo: ExpoPushService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('PUSH_ENABLED') !== 'true') return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 5_000);
    this.timer.unref();
    void this.tick();
  }
  onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running || this.stopping) return;
    this.running = true;
    try {
      const now = new Date();
      const jobs = await this.prisma.pushDelivery.findMany({
        where: {
          status: { in: ['PENDING', 'RECEIPT'] },
          nextAttemptAt: { lte: now },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        },
        orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
        take: 50,
      });
      for (const candidate of jobs) {
        if (this.stopping) break;
        const claimId = randomUUID();
        const claimed = await this.prisma.pushDelivery.updateMany({
          where: {
            id: candidate.id,
            status: candidate.status,
            nextAttemptAt: { lte: now },
            OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
          },
          data: { claimId, leaseUntil: new Date(Date.now() + 60_000) },
        });
        if (!claimed.count) continue;
        const job = await this.prisma.pushDelivery.findUnique({
          where: { id: candidate.id },
          include: { notification: true, device: true },
        });
        if (job) await this.deliver(job, claimId);
      }
    } catch {
      this.logger.error(
        'Falha no processamento da fila push; nova tentativa no próximo ciclo.',
      );
    } finally {
      this.running = false;
    }
  }

  private async deliver(job: Delivery, claimId: string) {
    const update = (data: Prisma.PushDeliveryUpdateManyMutationInput) =>
      this.prisma.pushDelivery.updateMany({
        where: { id: job.id, claimId },
        data: { ...data, claimId: null, leaseUntil: null },
      });
    if (
      !job.device.active ||
      job.device.version !== job.deviceVersion ||
      job.device.token !== job.token ||
      job.device.userId !== job.notification.userId
    ) {
      await update({ status: 'CANCELLED', lastError: 'DEVICE_CHANGED' });
      return;
    }
    if (Date.now() - job.createdAt.getTime() > DAY) {
      await update({ status: 'FAILED', lastError: 'EXPIRED' });
      return;
    }
    try {
      const checkingReceipt = job.status === 'RECEIPT';
      const result = checkingReceipt
        ? await this.expo.receipt(job.ticketId!)
        : await this.expo.send(pushMessage(job));
      if (!result) {
        await update({
          receiptAttempts: { increment: 1 },
          nextAttemptAt: new Date(Date.now() + 15 * 60_000),
        });
        return;
      }
      if (result.status === 'error') {
        const code = result.details?.error ?? 'UNKNOWN_EXPO_ERROR';
        if (code === 'DeviceNotRegistered') {
          await this.prisma.pushDevice.updateMany({
            where: {
              id: job.deviceId,
              token: job.token,
              version: job.deviceVersion,
            },
            data: { active: false },
          });
          await update({ status: 'CANCELLED', lastError: code });
          return;
        }
        throw new PushTransportError(code, code === 'MessageRateExceeded');
      }
      await update(
        checkingReceipt
          ? { status: 'DONE', lastError: null }
          : {
              status: 'RECEIPT',
              ticketId: result.id,
              attempts: { increment: 1 },
              lastError: null,
              nextAttemptAt: new Date(Date.now() + 15 * 60_000),
            },
      );
    } catch (error) {
      const transport =
        error instanceof PushTransportError
          ? error
          : new PushTransportError('DELIVERY_ERROR', true);
      const attempts = job.attempts + 1;
      const status: PushDeliveryStatus =
        transport.retryable && attempts < 8
          ? transport.code === 'MessageRateExceeded'
            ? 'PENDING'
            : job.status
          : 'FAILED';
      // Do not log tokens, capabilities, content or provider responses.
      this.logger.warn(`Push ${job.id}: ${transport.code}; ${status}`);
      await update({
        status,
        attempts,
        lastError: transport.code,
        nextAttemptAt: new Date(
          Date.now() + Math.min(3_600_000, 30_000 * 2 ** (attempts - 1)),
        ),
      });
    }
  }
}
