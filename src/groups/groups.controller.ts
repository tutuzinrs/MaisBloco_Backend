import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';

import { GroupsService } from './groups.service';
import { GroupInvitesService } from './group-invites.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsQueryDto } from './dto/groups-query.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { LinkBlocoDto } from './dto/link-bloco.dto';
import { CreateGroupInvitesDto } from './dto/create-group-invites.dto';
import { GroupInvitesQueryDto } from './dto/group-invites-query.dto';

type AuthRequest = Request & { user: AuthenticatedUser };

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly groupInvitesService: GroupInvitesService,
  ) {}

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(req.user.sub, dto);
  }

  @Get('me')
  findMyGroups(@Req() req: AuthRequest, @Query() query: GroupsQueryDto) {
    return this.groupsService.findMyGroups(req.user.sub, query);
  }

  @Get('invites/received')
  findReceivedInvites(
    @Req() req: AuthRequest,
    @Query() query: GroupInvitesQueryDto,
  ) {
    return this.groupInvitesService.findReceived(req.user.sub, query);
  }

  @Get('invites/sent')
  findSentInvites(
    @Req() req: AuthRequest,
    @Query() query: GroupInvitesQueryDto,
  ) {
    return this.groupInvitesService.findSent(req.user.sub, query);
  }

  @Patch('invites/:inviteId/accept')
  acceptInvite(
    @Req() req: AuthRequest,
    @Param('inviteId', ParseIntPipe) inviteId: number,
  ) {
    return this.groupInvitesService.accept(req.user.sub, inviteId);
  }

  @Patch('invites/:inviteId/reject')
  rejectInvite(
    @Req() req: AuthRequest,
    @Param('inviteId', ParseIntPipe) inviteId: number,
  ) {
    return this.groupInvitesService.reject(req.user.sub, inviteId);
  }

  @Get(':groupId')
  findOne(@Req() req: AuthRequest, @Param('groupId', ParseIntPipe) groupId: number) {
    return this.groupsService.findOne(req.user.sub, groupId);
  }

  @Get(':groupId/members')
  findMembers(@Req() req: AuthRequest, @Param('groupId', ParseIntPipe) groupId: number) {
    return this.groupsService.findMembers(req.user.sub, groupId);
  }

  @Get(':groupId/invites')
  findPendingInvites(
    @Req() req: AuthRequest,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.groupInvitesService.listPending(req.user.sub, groupId);
  }

  @Post(':groupId/invites')
  createInvites(
    @Req() req: AuthRequest,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: CreateGroupInvitesDto,
  ) {
    return this.groupInvitesService.create(req.user.sub, groupId, dto);
  }

  @Delete(':groupId/invites/:inviteId')
  @HttpCode(HttpStatus.OK)
  cancelInvite(
    @Req() req: AuthRequest,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('inviteId', ParseIntPipe) inviteId: number,
  ) {
    return this.groupInvitesService.cancel(req.user.sub, groupId, inviteId);
  }

  @Post(':groupId/join')
  @HttpCode(HttpStatus.OK)
  join(@Req() req: AuthRequest, @Param('groupId', ParseIntPipe) groupId: number) {
    return this.groupsService.join(req.user.sub, groupId);
  }

  @Post(':groupId/bloco')
  linkBloco(
    @Req() req: AuthRequest,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: LinkBlocoDto,
  ) {
    return this.groupsService.linkBloco(req.user.sub, groupId, dto.eventId);
  }

  @Delete(':groupId/bloco')
  @HttpCode(HttpStatus.OK)
  unlinkBloco(
    @Req() req: AuthRequest,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.groupsService.unlinkBloco(req.user.sub, groupId);
  }

  @Post(':groupId/members')
  addMember(
    @Req() req: AuthRequest,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: AddMemberDto,
  ) {
    return this.groupsService.addMember(req.user.sub, groupId, dto.userId);
  }

  @Delete(':groupId/leave')
  @HttpCode(HttpStatus.OK)
  leave(@Req() req: AuthRequest, @Param('groupId', ParseIntPipe) groupId: number) {
    return this.groupsService.leave(req.user.sub, groupId);
  }

  @Delete(':groupId/members/:userId')
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Req() req: AuthRequest,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('userId', ParseIntPipe) memberId: number,
  ) {
    return this.groupsService.removeMember(req.user.sub, groupId, memberId);
  }

  @Patch(':groupId')
  update(
    @Req() req: AuthRequest,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(req.user.sub, groupId, dto);
  }

  @Patch(':groupId/members/:userId/role')
  changeRole(
    @Req() req: AuthRequest,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('userId', ParseIntPipe) memberId: number,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.groupsService.changeRole(
      req.user.sub,
      groupId,
      memberId,
      dto.role,
    );
  }
}