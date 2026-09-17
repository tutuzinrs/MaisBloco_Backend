import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { NotificationsService } from './notifications.service';

type AuthRequest = Request & { user: AuthenticatedUser };

@UseGuards(JwtAuthGuard)
@Controller('users/me/notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@Req() req: AuthRequest, @Query() query: NotificationsQueryDto) {
    return this.service.list(req.user.sub, query);
  }

  @Get('unread-count')
  unreadCount(@Req() req: AuthRequest) {
    return this.service.unreadCount(req.user.sub);
  }

  @Patch('read-all')
  markAllRead(@Req() req: AuthRequest) {
    return this.service.markAllRead(req.user.sub);
  }

  @Patch(':id/read')
  markRead(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.markRead(req.user.sub, id);
  }
}