import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

import { AdminGroupsService } from './admin-groups.service';
import { AdminGroupsQueryDto } from './dto/admin-groups-query.dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/groups')
export class AdminGroupsController {
  constructor(private readonly adminGroupsService: AdminGroupsService) {}

  @Get()
  findAll(@Query() query: AdminGroupsQueryDto) {
    return this.adminGroupsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminGroupsService.findOne(id);
  }
}