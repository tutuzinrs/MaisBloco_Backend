import {
  isValidCpf,
  maskCpf,
  normalizeCpf,
} from './cpf';
import {
  isValidBrazilianPhone,
  maskPhone,
  normalizePhone,
} from './phone';
import { getPasswordRequirements, isStrongPassword } from './password';
import { getAge, isValidBirthDate, MIN_AGE } from './birth-date';

describe('cpf validators', () => {
  it('normalizes a masked CPF to digits only', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
  });

  it('accepts a valid CPF', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-25')).toBe(true);
  });

  it('rejects invalid length', () => {
    expect(isValidCpf('123')).toBe(false);
    expect(isValidCpf('111')).toBe(false);
  });

  it('rejects repeated digits', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('00000000000')).toBe(false);
  });

  it('rejects wrong check digits', () => {
    expect(isValidCpf('52998224724')).toBe(false);
  });

  it('masks all but the last two digits', () => {
    expect(maskCpf('52998224725')).toBe('***.***.***-25');
  });
});

describe('phone validators', () => {
  it('normalizes a BR phone to digits', () => {
    expect(normalizePhone('(11) 99999-9999')).toBe('11999999999');
  });

  it('accepts valid mobile numbers', () => {
    expect(isValidBrazilianPhone('(11) 99999-9999')).toBe(true);
    expect(isValidBrazilianPhone('11999999999')).toBe(true);
  });

  it('accepts valid landline numbers', () => {
    expect(isValidBrazilianPhone('(11) 3456-7890')).toBe(true);
  });

  it('rejects invalid DDD', () => {
    expect(isValidBrazilianPhone('(00) 99999-9999')).toBe(false);
  });

  it('rejects repeated digits', () => {
    expect(isValidBrazilianPhone('(11) 11111-1111')).toBe(false);
  });

  it('rejects 11-digit numbers not starting with 9', () => {
    expect(isValidBrazilianPhone('(11) 81234-5678')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidBrazilianPhone('(11) 9999-999')).toBe(false);
  });

  it('masks sensitive parts', () => {
    expect(maskPhone('11999999999', true)).toBe('(11) *****-9999');
  });
});

describe('password validator', () => {
  it('returns all unmet requirements for weak password', () => {
    const issues = getPasswordRequirements('abc').filter((r) => !r.met);
    expect(issues.map((r) => r.key)).toEqual([
      'length',
      'uppercase',
      'number',
      'special',
    ]);
  });

  it('accepts a strong password', () => {
    expect(isStrongPassword('Abcdef12!')).toBe(true);
  });

  it('rejects short password', () => {
    expect(isStrongPassword('Abc12!')).toBe(false);
  });

  it('rejects missing special char', () => {
    expect(isStrongPassword('Abcdef123')).toBe(false);
  });
});

describe('birth date validator', () => {
  it('rejects future dates', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(isValidBirthDate(future.toISOString())).toBe(false);
  });

  it('rejects underage users', () => {
    const young = new Date();
    young.setFullYear(young.getFullYear() - (MIN_AGE - 2));
    expect(isValidBirthDate(young.toISOString())).toBe(false);
  });

  it('accepts users at or above minimum age', () => {
    const adult = new Date();
    adult.setFullYear(adult.getFullYear() - MIN_AGE);
    expect(isValidBirthDate(adult.toISOString())).toBe(true);
  });

  it('rejects invalid dates', () => {
    expect(isValidBirthDate('not-a-date')).toBe(false);
  });

  it('computes age correctly', () => {
    const birth = new Date('2005-04-15T00:00:00Z');
    const now = new Date();
    const expected = now.getFullYear() - 2005;
    expect(getAge(birth)).toBe(expected);
  });
});