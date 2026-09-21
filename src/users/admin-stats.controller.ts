import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminStatsController {
  constructor(private readonly prisma: PrismaService) {}

  /* ── GET /admin/stats  (legado — mantido para compatibilidade) ── */
  @Get('stats')
  async getStats() {
    const [users, groups, blocos] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.group.count(),
      this.prisma.bloco.count(),
    ]);

    return { users, groups, blocos };
  }

  /* ── GET /admin/dashboard ── */
  @Get('dashboard')
  async getDashboard() {
    const now = new Date();

    /* ── 1. KPIs ── */
    const [totalUsers, totalBlocos, totalGroups, openReports] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.bloco.count(),
        this.prisma.group.count(),
        this.prisma.report.count({ where: { resolved: false } }),
      ]);

    /* ── 2. Novos usuários por dia — últimos 7 dias ── */
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const rawWeeklyUsers = await this.prisma.user.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { id: true },
    });

    // Bucket por dia (YYYY-MM-DD)
    const weeklyMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      weeklyMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const row of rawWeeklyUsers) {
      const key = new Date(row.createdAt).toISOString().slice(0, 10);
      if (key in weeklyMap) weeklyMap[key] += row._count.id;
    }
    const weeklySignups = Object.entries(weeklyMap).map(([date, count]) => ({
      date,
      count,
    }));

    /* ── 3. Blocos por cidade — top 5 ── */
    const rawByCity = await this.prisma.bloco.groupBy({
      by: ['city'],
      where: { city: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });
    const blocosByCity = rawByCity.map((r) => ({
      city: r.city ?? 'Desconhecida',
      total: r._count.id,
    }));

    /* ── 4. Blocos por status (proxy para "estilos") ── */
    const rawByStatus = await this.prisma.bloco.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const blocosByStatus = rawByStatus.map((r) => ({
      status: r.status,
      total: r._count.id,
    }));

    /* ── 5. Participações em eventos por mês — últimos 7 meses ── */
    const sevenMonthsAgo = new Date(now);
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 6);
    sevenMonthsAgo.setDate(1);
    sevenMonthsAgo.setHours(0, 0, 0, 0);

    const rawMonthly = await this.prisma.eventParticipant.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: sevenMonthsAgo } },
      _count: { id: true },
    });

    const monthlyMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenMonthsAgo);
      d.setMonth(d.getMonth() + i);
      monthlyMap[d.toISOString().slice(0, 7)] = 0;
    }
    for (const row of rawMonthly) {
      const key = new Date(row.createdAt).toISOString().slice(0, 7);
      if (key in monthlyMap) monthlyMap[key] += row._count.id;
    }
    const monthlyParticipants = Object.entries(monthlyMap).map(
      ([month, count]) => ({ month, count }),
    );

    /* ── 6. Top 5 blocos por estimatedPeople ── */
    const topBlocos = await this.prisma.bloco.findMany({
      where: { estimatedPeople: { not: null } },
      orderBy: { estimatedPeople: 'desc' },
      take: 5,
      select: {
        name: true,
        city: true,
        estimatedPeople: true,
        status: true,
      },
    });

    /* ── 7. Atividade recente (mix: reports + novos users + novos blocos) ── */
    const [recentReports, recentUsers, recentBlocos] = await Promise.all([
      this.prisma.report.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { title: true, reason: true, createdAt: true },
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { name: true, createdAt: true },
      }),
      this.prisma.bloco.findMany({
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { name: true, createdAt: true },
      }),
    ]);

    const recentActivity = [
      ...recentReports.map((r) => ({
        type: 'REPORT' as const,
        description: `Reporte: "${r.title ?? r.reason}"`,
        createdAt: r.createdAt,
      })),
      ...recentUsers.map((u) => ({
        type: 'USER' as const,
        description: `Novo usuário: ${u.name}`,
        createdAt: u.createdAt,
      })),
      ...recentBlocos.map((b) => ({
        type: 'BLOCO' as const,
        description: `Bloco criado: "${b.name}"`,
        createdAt: b.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    return {
      kpis: {
        users: totalUsers,
        blocos: totalBlocos,
        groups: totalGroups,
        openReports,
      },
      weeklySignups,
      blocosByCity,
      blocosByStatus,
      monthlyParticipants,
      topBlocos,
      recentActivity,
    };
  }
}