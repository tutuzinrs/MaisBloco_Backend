import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateReportDto {
  @IsString({ message: 'O título é obrigatório.' })
  @Transform(trim)
  @MinLength(3, { message: 'O título deve ter ao menos 3 caracteres.' })
  @MaxLength(200, {
    message: 'O título deve ter no máximo 200 caracteres.',
  })
  title: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(2000, {
    message: 'A descrição deve ter no máximo 2000 caracteres.',
  })
  description?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(2000, {
    message: 'A URL da imagem deve ter no máximo 2000 caracteres.',
  })
  imageUrl?: string | null;
}