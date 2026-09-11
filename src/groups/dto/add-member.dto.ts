import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty } from 'class-validator';

export class AddMemberDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty({ message: 'O id do usuário é obrigatório.' })
  userId: number;
}