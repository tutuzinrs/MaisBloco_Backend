import { ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  RegisterPushDeviceDto,
  RevokePushDeviceDto,
} from './dto/push-device.dto';

@Injectable()
export class PushDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: number, input: RegisterPushDeviceDto) {
    const secretHash = createHash('sha256').update(input.secret).digest('hex');
    await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.pushDevice.findUnique({
          where: { id: input.deviceId },
        });
        if (existing && existing.secretHash !== secretHash)
          throw new ForbiddenException('Dispositivo não autorizado.');
        // A reinstall may retain the Expo token but generate a new installation ID.
        await tx.pushDevice.deleteMany({
          where: { token: input.token, id: { not: input.deviceId } },
        });
        const unchanged =
          existing?.userId === userId &&
          existing?.token === input.token &&
          existing.active;
        await tx.pushDevice.upsert({
          where: { id: input.deviceId },
          create: {
            id: input.deviceId,
            userId,
            token: input.token,
            platform: input.platform,
            secretHash,
          },
          update: {
            userId,
            token: input.token,
            platform: input.platform,
            active: true,
            version: unchanged ? undefined : { increment: 1 },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return { success: true };
  }

  async revoke(input: RevokePushDeviceDto) {
    // This capability only revokes one installation; it cannot read data or send push.
    // It also works after JWT expiry, and is safe to retry after an offline logout.
    await this.prisma.pushDevice.updateMany({
      where: {
        id: input.deviceId,
        secretHash: createHash('sha256').update(input.secret).digest('hex'),
        active: true,
      },
      data: { active: false, version: { increment: 1 } },
    });
    return { success: true };
  }
}
