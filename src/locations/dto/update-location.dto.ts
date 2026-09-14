import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateLocationDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'latitude deve ser um número.' })
  @Min(-90, { message: 'latitude deve estar entre -90 e 90.' })
  @Max(90, { message: 'latitude deve estar entre -90 e 90.' })
  latitude!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'longitude deve ser um número.' })
  @Min(-180, { message: 'longitude deve estar entre -180 e 180.' })
  @Max(180, { message: 'longitude deve estar entre -180 e 180.' })
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'accuracy deve ser um número.' })
  @Min(0, { message: 'accuracy não pode ser negativa.' })
  @Max(100_000, { message: 'accuracy inválida.' })
  accuracy?: number;
}