import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const ADMIN_GROUPS_MAX_LIMIT = 100;

export class AdminGroupsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Busca muito longa.' })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página deve ser um número inteiro.' })
  @Min(1, { message: 'A página deve ser maior ou igual a 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1, { message: 'O limite deve ser maior ou igual a 1.' })
  @Max(ADMIN_GROUPS_MAX_LIMIT, {
    message: `O limite máximo por página é ${ADMIN_GROUPS_MAX_LIMIT}.`,
  })
  limit?: number = 20;
}