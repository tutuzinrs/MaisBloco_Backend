export const MIN_AGE = 16;

export function getAge(birthDate: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const birth = new Date(
    birthDate.getFullYear(),
    birthDate.getMonth(),
    birthDate.getDate(),
  );

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function isValidBirthDate(raw: string | Date): boolean {
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  if (date.getTime() > Date.now()) {
    return false;
  }
  return getAge(date) >= MIN_AGE;
}

export function formatBirthDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}