import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'Token de recuperação ausente.' })
  @IsString()
  token: string;

  @IsNotEmpty({ message: 'Informe uma nova senha.' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  password: string;

  @IsNotEmpty({ message: 'Confirme sua nova senha.' })
  @IsString()
  @MinLength(8)
  passwordConfirmation: string;
}