import { UserEventsService } from './user-events.service';
import { UserPreferencesService } from './user-preferences.service';
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, UserEventsService, UserPreferencesService],
})
export class UsersModule {}