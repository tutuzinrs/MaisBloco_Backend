import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Informe seu e-mail ou nome de usuário.' })
  @IsString()
  @MaxLength(150)
  identifier: string;

  @IsNotEmpty({ message: 'Informe sua senha.' })
  @IsString()
  @MinLength(1)
  password: string;
}