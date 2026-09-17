import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushDevicesService } from './push-devices.service';
import {
  RegisterPushDeviceDto,
  RevokePushDeviceDto,
} from './dto/push-device.dto';

@Controller('push/devices')
export class PushController {
  constructor(private readonly devices: PushDevicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  register(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() body: RegisterPushDeviceDto,
  ) {
    return this.devices.register(req.user.sub, body);
  }

  @Post('revoke')
  revoke(@Body() body: RevokePushDeviceDto) {
    return this.devices.revoke(body);
  }
}
