export function normalizeCpf(cpf: string): string {
  return (cpf ?? '').replace(/\D/g, '');
}

export function maskCpf(cpf: string): string {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) {
    return cpf;
  }
  return `***.***.***-${digits.slice(9)}`;
}

export function isValidCpf(cpf: string): boolean {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) {
    return false;
  }
  if (/^(\d)\1+$/.test(digits)) {
    return false;
  }

  for (let n = 9; n < 11; n += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
      sum += Number(digits[i]) * (n + 1 - i);
    }
    const checkDigit = ((sum * 10) % 11) % 10;
    if (Number(digits[n]) !== checkDigit) {
      return false;
    }
  }

  return true;
}