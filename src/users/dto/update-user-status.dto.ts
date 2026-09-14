import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateUserStatusDto {
  @IsNotEmpty({ message: 'Informe o status.' })
  @IsIn(['ACTIVE', 'BLOCKED'], { message: 'Status inválido.' })
  status: 'ACTIVE' | 'BLOCKED';
}