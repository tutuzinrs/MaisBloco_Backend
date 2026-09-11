import { UserEventsService } from './user-events.service';
import { UserPreferencesService } from './user-preferences.service';
import { MyEventsQueryDto, NotificationPreferencesDto, PrivacyDto } from './dto/profile.dto';
import { Controller, Body, Delete, Param, Patch, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';

import { UsersService } from './users.service';
import { SearchUsersDto } from './dto/search-users.dto';

type AuthRequest = Request & { user: AuthenticatedUser };

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService, private readonly preferences: UserPreferencesService, private readonly events: UserEventsService) {}

  @Get('search')
  search(@Req() req: AuthRequest, @Query() query: SearchUsersDto) {
    return this.usersService.search(req.user.sub, query);
  }

  @Get('me/friends-count')
  countFriends(@Req() req: AuthRequest) {
    return this.usersService.countFriends(req.user.sub);
  }

  @Get('me/favorites-count')
  countFavorites(@Req() req: AuthRequest) {
    return this.usersService.countFavorites(req.user.sub);
  }

  @Get('me/privacy')
  privacy(@Req() req: AuthRequest) { return this.preferences.privacy(req.user.sub); }
  @Patch('me/privacy')
  updatePrivacy(@Req() req: AuthRequest, @Body() dto: PrivacyDto) { return this.preferences.updatePrivacy(req.user.sub, dto); }
  @Get('me/notification-preferences')
  notifications(@Req() req: AuthRequest) { return this.preferences.notifications(req.user.sub); }
  @Patch('me/notification-preferences')
  updateNotifications(@Req() req: AuthRequest, @Body() dto: NotificationPreferencesDto) { return this.preferences.updateNotifications(req.user.sub, dto); }
  @Get('me/events')
  myEvents(@Req() req: AuthRequest, @Query() query: MyEventsQueryDto) { return this.events.list(req.user.sub, query); }
  @Delete('me/favorites/:eventId')
  removeFavorite(@Req() req: AuthRequest, @Param('eventId') id: string) { return this.events.removeFavorite(req.user.sub, id); }
  @Delete('me/participations/:eventId')
  cancelParticipation(@Req() req: AuthRequest, @Param('eventId') id: string) { return this.events.cancelParticipation(req.user.sub, id); }
}