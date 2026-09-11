import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';

import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { Throttle } from '../common/rate-limit/rate-limit.decorator';

import { EventsService } from './events.service';
import { EventsQueryDto } from './dto/events-query.dto';

@UseInterceptors(RateLimitGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @Throttle({ limit: 60, ttlMs: 60_000 })
  findAll(@Query() query: EventsQueryDto) {
    return this.eventsService.findAll(query);
  }
}