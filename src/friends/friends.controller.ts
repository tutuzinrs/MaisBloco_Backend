import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FriendsService } from './friends.service';
import {
  FriendActionDto,
  FriendsQueryDto,
  FriendTargetDto,
} from './dto/friends.dto';
type AuthRequest = Request & { user: AuthenticatedUser };
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly service: FriendsService) {}
  @Get() list(@Req() req: AuthRequest, @Query() query: FriendsQueryDto) {
    return this.service.list(req.user.sub, query);
  }
  @Post('requests') request(
    @Req() req: AuthRequest,
    @Body() dto: FriendTargetDto,
  ) {
    return this.service.request(req.user.sub, dto.userId);
  }
  @Patch('requests/:id') respond(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: FriendActionDto,
  ) {
    return this.service.respond(req.user.sub, id, dto.action);
  }
  @Get('blocks') blocks(
    @Req() req: AuthRequest,
    @Query() query: FriendsQueryDto,
  ) {
    return this.service.blocks(req.user.sub, query);
  }
  @Post('blocks') block(@Req() req: AuthRequest, @Body() dto: FriendTargetDto) {
    return this.service.block(req.user.sub, dto.userId);
  }
  @Delete('blocks/:userId') unblock(
    @Req() req: AuthRequest,
    @Param('userId') id: string,
  ) {
    return this.service.unblock(req.user.sub, id);
  }
  @Delete(':id') remove(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.remove(req.user.sub, id);
  }
}
