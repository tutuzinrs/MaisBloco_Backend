import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsNotEmpty({ message: 'Informe seu e-mail.' })
  @IsEmail({}, { message: 'Digite um e-mail válido.' })
  email: string;
}