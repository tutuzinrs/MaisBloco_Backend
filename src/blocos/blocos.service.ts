import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreateBlocoDto } from './dto/create-bloco.dto';
import { UpdateBlocoDto } from './dto/update-bloco.dto';
import { BlocosQueryDto } from './dto/blocos-query.dto';

@Injectable()
export class BlocosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: BlocosQueryDto) {
    const { search, status, city, page = 1, limit = 20 } = query;

    const where: Prisma.BlocoWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (search) {
      const term = search.trim();
      if (term) {
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { neighborhood: { contains: term, mode: 'insensitive' } },
          { city: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.bloco.findMany({
        where,
        orderBy: [{ startAt: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.bloco.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    };
  }

  async findOne(id: number) {
    const bloco = await this.prisma.bloco.findUnique({ where: { id } });
    if (!bloco) {
      throw new NotFoundException('Bloco não encontrado.');
    }
    return bloco;
  }

  create(dto: CreateBlocoDto) {
    return this.prisma.bloco.create({ data: dto });
  }

  async update(id: number, dto: UpdateBlocoDto) {
    await this.findOne(id);
    return this.prisma.bloco.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.bloco.delete({ where: { id } });
  }
}