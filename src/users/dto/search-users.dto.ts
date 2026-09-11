import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const USERS_SEARCH_MAX_LIMIT = 50;
export const USERS_SEARCH_MAX_LENGTH = 60;

export class SearchUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(USERS_SEARCH_MAX_LENGTH, {
    message: `A busca pode ter no máximo ${USERS_SEARCH_MAX_LENGTH} caracteres.`,
  })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página deve ser um número inteiro.' })
  @Min(1, { message: 'A página deve ser maior ou igual a 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1, { message: 'O limite deve ser maior ou igual a 1.' })
  @Max(USERS_SEARCH_MAX_LIMIT, {
    message: `O limite máximo por página é ${USERS_SEARCH_MAX_LIMIT}.`,
  })
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  excludeGroupId?: number;
}