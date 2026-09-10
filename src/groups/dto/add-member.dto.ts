import { IsNotEmpty, IsString } from 'class-validator';

export class AddMemberDto {
  @IsString()
  @IsNotEmpty({ message: 'O id do usuário é obrigatório.' })
  userId: string;
}