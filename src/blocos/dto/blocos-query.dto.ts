import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { BlocoStatus } from '@prisma/client';

export class BlocosQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Busca muito longa.' })
  search?: string;

  @IsOptional()
  @IsEnum(BlocoStatus, { message: 'Status inválido.' })
  status?: BlocoStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Cidade muito longa.' })
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}