import { IsIn } from 'class-validator';

export const ASSIGNABLE_ROLES = ['ADMIN', 'MEMBER'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export class ChangeRoleDto {
  @IsIn(ASSIGNABLE_ROLES, {
    message: 'O papel deve ser ADMIN ou MEMBER.',
  })
  role: AssignableRole;
}