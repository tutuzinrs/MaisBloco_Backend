import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';

import { LocationsService } from './locations.service';
import { UpdateLocationDto } from './dto/update-location.dto';

type AuthRequest = Request & { user: AuthenticatedUser };

@UseGuards(JwtAuthGuard)
@Controller('users')
export class MyLocationController {
  constructor(private readonly locations: LocationsService) {}

  @Patch('me/location')
  update(@Req() req: AuthRequest, @Body() dto: UpdateLocationDto) {
    return this.locations.updateLocation(req.user.sub, dto);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupLocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get(':groupId/locations')
  groupLocations(
    @Req() req: AuthRequest,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.locations.listGroupLocations(req.user.sub, groupId);
  }
}