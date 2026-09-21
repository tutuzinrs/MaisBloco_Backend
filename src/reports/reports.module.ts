import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { ReportsController } from './reports.controller';
import { ReportsEventsService } from './reports-events.service';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsEventsService],
})
export class ReportsModule {}