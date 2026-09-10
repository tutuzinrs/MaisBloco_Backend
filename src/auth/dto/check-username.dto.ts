import { IsNotEmpty, IsString } from 'class-validator';

export class CheckUsernameQueryDto {
  @IsNotEmpty({ message: 'Informe um nome de usuário.' })
  @IsString()
  username: string;
}