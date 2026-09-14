import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { LocationsService } from './locations.service';
import {
  GroupLocationsController,
  MyLocationController,
} from './locations.controller';

@Module({
  imports: [AuthModule],
  controllers: [MyLocationController, GroupLocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}