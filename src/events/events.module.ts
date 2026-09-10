import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RateLimitService } from '../common/rate-limit/rate-limit.guard';

import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { CodanteProvider } from './providers/codante.provider';

@Module({
  imports: [ConfigModule],
  controllers: [EventsController],
  providers: [EventsService, CodanteProvider, RateLimitService],
})
export class EventsModule {}