import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
} from 'class-validator';

export const GROUP_INVITES_MAX = 50;

export class CreateGroupInvitesDto {
  @IsArray({ message: 'Informe ao menos um usuário para convidar.' })
  @ArrayMinSize(1, { message: 'Convite pelo menos um usuário.' })
  @ArrayMaxSize(GROUP_INVITES_MAX, {
    message: `No máximo ${GROUP_INVITES_MAX} convites por vez.`,
  })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Cada convite precisa de um id de usuário.' })
  @IsNotEmpty({ each: true, message: 'O id do usuário é obrigatório.' })
  userIds: number[];
}