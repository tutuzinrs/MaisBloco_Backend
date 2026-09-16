import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PushController } from './push.controller';
import { PushDevicesService } from './push-devices.service';
import { PushWorkerService } from './push-worker.service';
import { ExpoPushService } from './expo-push.service';

@Module({
  imports: [AuthModule],
  controllers: [PushController],
  providers: [PushDevicesService, ExpoPushService, PushWorkerService],
})
export class PushModule {}
