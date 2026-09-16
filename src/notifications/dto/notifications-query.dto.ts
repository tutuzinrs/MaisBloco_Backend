import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const NOTIFICATIONS_MAX_LIMIT = 50;

export class NotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página deve ser um número inteiro.' })
  @Min(1, { message: 'A página deve ser maior ou igual a 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1, { message: 'O limite deve ser maior ou igual a 1.' })
  @Max(NOTIFICATIONS_MAX_LIMIT, {
    message: `O limite máximo por página é ${NOTIFICATIONS_MAX_LIMIT}.`,
  })
  limit?: number = 20;
}