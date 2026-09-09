import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SocialAuthDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsNotEmpty()
  @IsIn(['google', 'apple'])
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