import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupInvitesService } from './group-invites.service';

@Module({
  imports: [AuthModule],
  controllers: [GroupsController],
  providers: [GroupsService, GroupInvitesService],
})
export class GroupsModule {}