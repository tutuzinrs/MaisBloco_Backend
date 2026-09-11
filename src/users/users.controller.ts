import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';

import { UsersService } from './users.service';
import { SearchUsersDto } from './dto/search-users.dto';

type AuthRequest = Request & { user: AuthenticatedUser };

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}