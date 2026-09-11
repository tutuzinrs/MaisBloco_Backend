import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'O nome do grupo não pode ser vazio.' })
  @MaxLength(60, { message: 'O nome pode ter no máximo 60 caracteres.' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'A descrição pode ter no máximo 500 caracteres.' })
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'O avatar pode ter no máximo 500 caracteres.' })
  avatar?: string | null;
}