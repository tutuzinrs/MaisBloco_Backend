import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ReviewReportDto {
  @IsBoolean({ message: 'Informe se o reporte foi resolvido.' })
  resolved: boolean;

  @ValidateIf((o: ReviewReportDto) => o.resolved === true)
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(2000, {
    message: 'A conclusão deve ter no máximo 2000 caracteres.',
  })
  resolution?: string | null;
}