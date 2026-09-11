import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export const GROUP_INVITES_MAX = 50;

export class CreateGroupInvitesDto {
  @IsArray({ message: 'Informe ao menos um usuário para convidar.' })
  @ArrayMinSize(1, { message: 'Convite pelo menos um usuário.' })
  @ArrayMaxSize(GROUP_INVITES_MAX, {
    message: `No máximo ${GROUP_INVITES_MAX} convites por vez.`,
  })
  @IsString({ each: true, message: 'Cada convite precisa de um id de usuário.' })
  @IsNotEmpty({ each: true, message: 'O id do usuário é obrigatório.' })
  userIds: string[];
}