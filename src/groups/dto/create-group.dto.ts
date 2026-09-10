import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome do grupo é obrigatório.' })
  @MaxLength(60, { message: 'O nome pode ter no máximo 60 caracteres.' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'A descrição pode ter no máximo 500 caracteres.' })
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'O avatar pode ter no máximo 500 caracteres.' })
  avatar?: string;
}