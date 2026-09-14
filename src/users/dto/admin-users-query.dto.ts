import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Busca muito longa.' })
  search?: string;

  @IsOptional()
  @IsIn([1, 2], { message: 'Role inválida.' })
  @Type(() => Number)
  role?: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'BLOCKED'], { message: 'Status inválido.' })
  status?: string;

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