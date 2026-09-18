import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { ReportsEventsService } from './reports-events.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ReportsEventsService,
  ) {}

  /* ── POST /reports (app) ── */
  async create(userId: number, dto: CreateReportDto) {
    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        reason: 'SUPPORT',
        title: dto.title,
        description: dto.description || null,
        imageUrl: dto.imageUrl || null,
      },
    });

    await this.pushOpenCount();

    return report;
  }

  /* ── GET /admin/reports ── */
  async listForAdmin(query: ListReportsQueryDto) {
    const where =
      query.status === 'all'
        ? {}
        : query.status === 'open'
          ? { resolved: false }
          : { resolved: true };

    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          title: true,
          reason: true,
          description: true,
          imageUrl: true,
          resolution: true,
          resolved: true,
          resolvedAt: true,
          createdAt: true,
          reporter: {
            select: {
              id: true,
              name: true,
              nickname: true,
              username: true,
              email: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /* ── PATCH /admin/reports/:id ── */
  async review(reportId: number, dto: ReviewReportDto) {
    const existing = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!existing) {
      throw new NotFoundException('Reporte não encontrado.');
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        resolved: dto.resolved,
        resolution: dto.resolved
          ? dto.resolution && dto.resolution.length > 0
            ? dto.resolution
            : existing.resolution
          : null,
        resolvedAt: dto.resolved ? new Date() : null,
      },
    });

    await this.pushOpenCount();

    return updated;
  }

  /* ── Emite o total de abertos via SSE ── */
  private async pushOpenCount() {
    const total = await this.prisma.report.count({
      where: { resolved: false },
    });
    this.events.emitOpenCount(total);
  }
}