import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const EVENT_SOURCES = ['MAISBLOCO', 'CODANTE', 'ALL'] as const;
export type EventSourceFilter = (typeof EVENT_SOURCES)[number];

export class EventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'Latitude inválida.' })
  @Min(-90, { message: 'Latitude deve estar entre -90 e 90.' })
  @Max(90, { message: 'Latitude deve estar entre -90 e 90.' })
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'Longitude inválida.' })
  @Min(-180, { message: 'Longitude deve estar entre -180 e 180.' })
  @Max(180, { message: 'Longitude deve estar entre -180 e 180.' })
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O raio deve ser um número inteiro.' })
  @Min(0, { message: 'O raio deve ser maior ou igual a zero.' })
  @Max(500, { message: 'O raio máximo permitido é 500 km.' })
  radius?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'A categoria pode ter no máximo 60 caracteres.' })
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'A busca pode ter no máximo 100 caracteres.' })
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'A cidade pode ter no máximo 60 caracteres.' })
  city?: string;

  @IsOptional()
  @IsIn(EVENT_SOURCES, {
    message: 'A origem deve ser MAISBLOCO, CODANTE ou ALL.',
  })
  source?: EventSourceFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página deve ser um número inteiro.' })
  @Min(1, { message: 'A página deve ser maior ou igual a 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1, { message: 'O limite deve ser maior ou igual a 1.' })
  @Max(100, { message: 'O limite máximo por página é 100.' })
  limit?: number = 100;
}