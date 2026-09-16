import { Body, Controller, Get, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { Throttle } from '../common/rate-limit/rate-limit.decorator';

import { EventsService } from './events.service';
import { EventsQueryDto } from './dto/events-query.dto';
import { CreateEventDto } from './dto/create-event.dto';

type AuthRequest = Request & { user: AuthenticatedUser };

@UseInterceptors(RateLimitGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @Throttle({ limit: 60, ttlMs: 60_000 })
  findAll(@Query() query: EventsQueryDto) {
    return this.eventsService.findAll(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ limit: 30, ttlMs: 60_000 })
  create(@Req() _req: AuthRequest, @Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }
}