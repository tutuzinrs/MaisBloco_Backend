import { IsString, MaxLength, MinLength } from 'class-validator';
export class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(72) currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
  @IsString() @MinLength(8) @MaxLength(72) passwordConfirmation: string;
}
