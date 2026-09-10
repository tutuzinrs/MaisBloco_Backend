import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'Informe seu nome completo.' })
  @IsString()
  @MinLength(3, { message: 'Seu nome deve ter pelo menos 3 caracteres.' })
  @MaxLength(100, { message: 'Seu nome deve ter no máximo 100 caracteres.' })
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Seu apelido deve ter pelo menos 2 caracteres.' })
  @MaxLength(30, { message: 'Seu apelido deve ter no máximo 30 caracteres.' })
  @Matches(/^[a-zA-ZÀ-ú0-9_. -]+$/, {
    message: 'O apelido contém caracteres inválidos.',
  })
  nickname?: string;

  @IsNotEmpty({ message: 'Informe seu nome de usuário.' })
  @IsString()
  @MinLength(3, { message: 'O nome de usuário deve ter pelo menos 3 caracteres.' })
  @MaxLength(30, { message: 'O nome de usuário deve ter no máximo 30 caracteres.' })
  @Matches(/^[a-z0-9_.]+$/, {
    message:
      'O nome de usuário pode conter apenas letras minúsculas, números, ponto e sublinhado.',
  })
  username: string;

  @IsNotEmpty({ message: 'Informe seu CPF.' })
  @IsString()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, {
    message: 'CPF inválido. Verifique os números digitados.',
  })
  cpf: string;

  @IsNotEmpty({ message: 'Informe seu telefone.' })
  @IsString()
  phone: string;

  @IsNotEmpty({ message: 'Informe seu e-mail.' })
  @IsEmail({}, { message: 'Digite um e-mail válido.' })
  email: string;

  @IsNotEmpty({ message: 'Informe sua data de nascimento.' })
  @IsDateString({}, { message: 'Informe uma data de nascimento válida.' })
  birthDate: string;

  @IsNotEmpty({ message: 'Informe uma senha.' })
  @IsString()
  @MinLength(8, {
    message: 'A senha deve ter pelo menos 8 caracteres.',
  })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  password: string;

  @IsNotEmpty({ message: 'Confirme sua senha.' })
  @IsString()
  @MinLength(8)
  passwordConfirmation: string;
}