import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { map, Observable } from 'rxjs';
import type { Request } from 'express';

import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { PrismaService } from '../prisma/prisma.service';

import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { ReportsEventsService, type ReportEvent } from './reports-events.service';
import { ReportsService } from './reports.service';

type AuthRequest = Request & { user: AuthenticatedUser };

@Controller()
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsEvents: ReportsEventsService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /* ── Enviar reporte (app móvel) ── */
  @UseGuards(JwtAuthGuard)
  @Post('reports')
  create(@Req() req: AuthRequest, @Body() dto: CreateReportDto) {
    return this.reportsService.create(req.user.sub, dto);
  }

  /* ── Listar reportes (admin) ── */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/reports')
  list(@Query() query: ListReportsQueryDto) {
    return this.reportsService.listForAdmin(query);
  }

  /* ── Avaliar/resolver reporte (admin) ── */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/reports/:id')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewReportDto,
  ) {
    return this.reportsService.review(id, dto);
  }

  /* ── Streaming em tempo real do contador (admin) ──
     EventSource não permite cabeçalho Bearer, então o token vai por query. */
  @Sse('admin/reports/events')
  async reportEvents(
    @Query('token') token: string,
  ): Promise<Observable<{ data: string }>> {
    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: { sub: number };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true },
    });
    if (user?.role !== 1) {
      throw new UnauthorizedException();
    }

    const sse = this.reportsEvents.events$.pipe(
      map((event: ReportEvent) => ({ data: JSON.stringify(event) })),
    );

    return sse;
  }
}