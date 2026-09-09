export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordRequirement {
  key: string;
  label: string;
  met: boolean;
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      key: 'length',
      label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
      met: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      key: 'uppercase',
      label: 'Letra maiúscula',
      met: /[A-Z]/.test(password),
    },
    {
      key: 'lowercase',
      label: 'Letra minúscula',
      met: /[a-z]/.test(password),
    },
    {
      key: 'number',
      label: 'Número',
      met: /\d/.test(password),
    },
    {
      key: 'special',
      label: 'Caractere especial',
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

export function isStrongPassword(password: string): boolean {
  return getPasswordRequirements(password).every((r) => r.met);
}