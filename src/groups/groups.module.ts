import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { GroupsController } from './groups.controller';
import { AdminGroupsController } from './admin-groups.controller';
import { GroupsService } from './groups.service';
import { AdminGroupsService } from './admin-groups.service';
import { GroupInvitesService } from './group-invites.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [GroupsController, AdminGroupsController],
  providers: [GroupsService, AdminGroupsService, GroupInvitesService],
})
export class GroupsModule {}