import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateUserRoleDto {
  @IsNotEmpty({ message: 'Informe o papel do usuário.' })
  @IsIn([1, 2], { message: 'Papel inválido. Use 1 (Admin) ou 2 (Cliente).' })
  role: 1 | 2;
}