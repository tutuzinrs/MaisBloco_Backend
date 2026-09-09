import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsDateString } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  username: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}

export class SocialAuthDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsNotEmpty()
  @IsString()
  provider: 'google' | 'apple';

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

export class RefreshTokenDto {
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}
