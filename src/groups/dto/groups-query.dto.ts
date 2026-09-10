import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const GROUPS_MAX_LIMIT = 50;

export class GroupsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'A busca pode ter no máximo 100 caracteres.' })
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
  @Max(GROUPS_MAX_LIMIT, { message: `O limite máximo por página é ${GROUPS_MAX_LIMIT}.` })
  limit?: number = 20;
}