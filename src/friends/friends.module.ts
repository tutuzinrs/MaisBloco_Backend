import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}