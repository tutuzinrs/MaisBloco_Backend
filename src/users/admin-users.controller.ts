import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

import { UsersService } from './users.service';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: AdminUsersQueryDto) {
    return this.usersService.findAllAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findAdminById(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(id, dto.status);
  }
}