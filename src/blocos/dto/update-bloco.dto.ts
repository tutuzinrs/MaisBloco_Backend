import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { BlocoStatus } from '@prisma/client';

export class UpdateBlocoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'O nome do bloco não pode ser vazio.' })
  @MaxLength(120, { message: 'O nome pode ter no máximo 120 caracteres.' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'A descrição pode ter no máximo 1000 caracteres.' })
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'A imagem pode ter no máximo 500 caracteres.' })
  image?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'A cidade pode ter no máximo 120 caracteres.' })
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'O bairro pode ter no máximo 120 caracteres.' })
  neighborhood?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'O endereço pode ter no máximo 300 caracteres.' })
  address?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLatitude({ message: 'Latitude inválida.' })
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude({ message: 'Longitude inválida.' })
  longitude?: number | null;

  @IsOptional()
  @IsDateString({}, { message: 'Data de início inválida.' })
  startAt?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Data de fim inválida.' })
  endAt?: string | null;

  @IsOptional()
  @IsEnum(BlocoStatus, { message: 'Status inválido.' })
  status?: BlocoStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Pessoas estimadas deve ser um número inteiro.' })
  @Min(0, { message: 'Pessoas estimadas não pode ser negativa.' })
  @Max(10000000, { message: 'Pessoas estimadas é inválida.' })
  estimatedPeople?: number | null;
}