export function normalizePhone(phone: string): string {
  return (phone ?? '').replace(/\D/g, '');
}

/**
 * Validates a Brazilian phone number.
 * - Exactly 10 (landline) or 11 (mobile) digits.
 * - Valid DDD (11–99).
 * - 11-digit numbers must start with 9 (modern mobile numbering).
 */
export function isValidBrazilianPhone(raw: string): boolean {
  const digits = normalizePhone(raw);
  if (digits.length !== 10 && digits.length !== 11) {
    return false;
  }

  const ddd = Number(digits.slice(0, 2));
  if (Number.isNaN(ddd) || ddd < 11 || ddd > 99) {
    return false;
  }

  if (/^(\d)\1+$/.test(digits)) {
    return false;
  }

  if (digits.length === 11 && digits[2] !== '9') {
    return false;
  }

  return true;
}

/** Masks `(11) 99999-9999` from digits, masking the 4 middle numbers when hide is true. */
export function maskPhone(raw: string, hide = false): string {
  const digits = normalizePhone(raw);
  if (digits.length < 10 && !hide) {
    return raw;
  }

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (hide) {
    const fixed = rest.slice(0, rest.length - 4);
    const last = rest.slice(-4);
    return `(${ddd}) ${'*'.repeat(fixed.length)}-${last}`;
  }

  if (rest.length === 9) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}