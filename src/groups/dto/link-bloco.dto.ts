import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class LinkBlocoDto {
  @Type(() => Number)
  @IsInt({ message: 'O identificador do bloco deve ser um número.' })
  @Min(1, { message: 'O identificador do bloco é inválido.' })
  eventId: number;
}