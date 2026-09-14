import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

import { BlocosService } from './blocos.service';
import { CreateBlocoDto } from './dto/create-bloco.dto';
import { UpdateBlocoDto } from './dto/update-bloco.dto';
import { BlocosQueryDto } from './dto/blocos-query.dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('blocos')
export class BlocosController {
  constructor(private readonly blocosService: BlocosService) {}

  @Get()
  findAll(@Query() query: BlocosQueryDto) {
    return this.blocosService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.blocosService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBlocoDto) {
    return this.blocosService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBlocoDto) {
    return this.blocosService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.blocosService.remove(id);
  }
}