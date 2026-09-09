import * as bcrypt from 'bcryptjs';
import { HttpStatus } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/mail/mail.service';
import { ErrorCode } from '../common/errors/error-codes';

import { AuthService } from './auth.service';

// NestJS 12 and bcryptjs 3 ship ESM-only builds that the CJS Jest runtime on
// this Node version cannot require. Replace them with runtime facades/mocks.
jest.mock('@nestjs/common', () => require('../test/mock-nest-common'));
jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('salted-hash'),
  compare: jest.fn().mockResolvedValue(true),
}));

const validDto = () => ({
  name: 'Arthur Nascimento',
  nickname: 'Arthur',
  username: 'arthur',
  cpf: '529.982.247-25',
  phone: '(11) 99999-9999',
  email: 'ARTHUR@Email.COM',
  birthDate: '2005-04-15',
  password: 'StrongPass1!',
  passwordConfirmation: 'StrongPass1!',
});

const userMock = (overrides: Record<string, unknown> = {}) => ({
  id: 'user_1',
  name: 'Arthur Nascimento',
  nickname: 'Arthur',
  username: 'arthur',
  email: 'arthur@email.com',
  passwordHash: null,
  cpf: '52998224725',
  phone: '11999999999',
  birthDate: new Date('2005-04-15T00:00:00Z'),
  avatar: null,
  city: null,
  status: 'ACTIVE',
  authProvider: 'LOCAL',
  authProviderId: null,
  failedLoginAttempts: 0,
  blockedUntil: null,
  lastLoginAt: null,
  locationSharingLevel: 'PRIVATE',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    passwordResetToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const jwtService = {
      signAsync: jest.fn().mockImplementation(
        (_payload: { sub: string }, options: { expiresIn?: string }) => {
          const isRefresh = String(options?.expiresIn).endsWith('d');
          return Promise.resolve(
            isRefresh ? `refresh_user` : `access_user`,
          );
        },
      ),
    };

    const mailService = { sendPasswordResetEmail: jest.fn() };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as never,
      mailService as unknown as MailService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('creates a user, normalizing data, and returns safe tokens', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(userMock());
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(validDto());

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Arthur Nascimento',
          nickname: 'Arthur',
          username: 'arthur',
          email: 'arthur@email.com',
          cpf: '52998224725',
          phone: '11999999999',
          authProvider: 'LOCAL',
          passwordHash: expect.any(String),
        }),
      });
      expect(result.accessToken).toBe('access_user');
      expect(result.refreshToken).toBe('refresh_user');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('cpf');
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('throws AUTH_EMAIL_ALREADY_EXISTS on duplicate email', async () => {
      prisma.user.findFirst.mockResolvedValue({ email: 'arthur@email.com' });

      await expect(service.register(validDto())).rejects.toMatchObject({
        code: ErrorCode.AUTH_EMAIL_ALREADY_EXISTS,
        status: HttpStatus.CONFLICT,
      });
    });

    it('throws AUTH_USERNAME_ALREADY_EXISTS on duplicate username', async () => {
      prisma.user.findFirst.mockResolvedValue({ username: 'arthur' });

      await expect(service.register(validDto())).rejects.toMatchObject({
        code: ErrorCode.AUTH_USERNAME_ALREADY_EXISTS,
      });
    });

    it('throws AUTH_CPF_ALREADY_EXISTS on duplicate CPF', async () => {
      prisma.user.findFirst.mockResolvedValue({ cpf: '52998224725' });

      await expect(service.register(validDto())).rejects.toMatchObject({
        code: ErrorCode.AUTH_CPF_ALREADY_EXISTS,
      });
    });

    it('throws AUTH_PHONE_ALREADY_EXISTS on duplicate phone', async () => {
      prisma.user.findFirst.mockResolvedValue({ phone: '11999999999' });

      await expect(service.register(validDto())).rejects.toMatchObject({
        code: ErrorCode.AUTH_PHONE_ALREADY_EXISTS,
      });
    });

    it('maps raw P2002 races to the correct conflict code', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['phone'] },
      });

      await expect(service.register(validDto())).rejects.toMatchObject({
        code: ErrorCode.AUTH_PHONE_ALREADY_EXISTS,
        status: HttpStatus.CONFLICT,
      });
    });

    it('throws AUTH_INVALID_CPF for a mathematically invalid CPF', async () => {
      await expect(
        service.register({ ...validDto(), cpf: '111.111.111-11' }),
      ).rejects.toMatchObject({ code: ErrorCode.AUTH_INVALID_CPF });
    });

    it('throws AUTH_INVALID_EMAIL for a malformed email', async () => {
      await expect(
        service.register({ ...validDto(), email: 'not-an-email' }),
      ).rejects.toMatchObject({ code: ErrorCode.AUTH_INVALID_EMAIL });
    });

    it('throws AUTH_INVALID_PHONE for an invalid phone', async () => {
      await expect(
        service.register({ ...validDto(), phone: '(00) 1234-5678' }),
      ).rejects.toMatchObject({ code: ErrorCode.AUTH_INVALID_PHONE });
    });

    it('throws AUTH_WEAK_PASSWORD for a weak password', async () => {
      await expect(
        service.register({ ...validDto(), password: 'abc', passwordConfirmation: 'abc' }),
      ).rejects.toMatchObject({ code: ErrorCode.AUTH_WEAK_PASSWORD });
    });

    it('throws AUTH_PASSWORD_MISMATCH when passwords differ', async () => {
      await expect(
        service.register({ ...validDto(), passwordConfirmation: 'Different1!' }),
      ).rejects.toMatchObject({ code: ErrorCode.AUTH_PASSWORD_MISMATCH });
    });

    it('throws AUTH_INVALID_BIRTH_DATE for underage users', async () => {
      const now = new Date();
      const underage = new Date(
        now.getFullYear() - 14,
        now.getMonth(),
        now.getDate(),
      ).toISOString();

      await expect(
        service.register({ ...validDto(), birthDate: underage }),
      ).rejects.toMatchObject({ code: ErrorCode.AUTH_INVALID_BIRTH_DATE });
    });

    it('throws VALIDATION_ERROR for missing required fields', async () => {
      await expect(
        service.register({
          ...validDto(),
          name: '  ',
          username: '',
          email: '',
          cpf: '',
          phone: '',
        }),
      ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      const hash = await bcrypt.hash('StrongPass1!', 10);
      prisma.user.findFirst.mockResolvedValue(userMock({ passwordHash: hash }));
      prisma.refreshToken.create.mockResolvedValue({});
    });

    it('logs in with email + correct password and returns safe tokens', async () => {
      prisma.user.update.mockResolvedValue({});

      const result = await service.login({
        identifier: 'ARTHUR@EMAIL.COM',
        password: 'StrongPass1!',
      });

      expect(result.user.email).toBe('arthur@email.com');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('cpf');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        }),
      );
    });

    it('logs in with username instead of email', async () => {
      const result = await service.login({
        identifier: '@arthur',
        password: 'StrongPass1!',
      });

      expect(result.user.username).toBe('arthur');
      void result;
    });

    it('throws AUTH_INVALID_CREDENTIALS for wrong password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      await expect(
        service.login({ identifier: 'arthur@email.com', password: 'WrongPass1!' }),
      ).rejects.toMatchObject({
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('throws AUTH_INVALID_CREDENTIALS for a non-existent user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.login({ identifier: 'ghost@email.com', password: 'StrongPass1!' }),
      ).rejects.toMatchObject({ code: ErrorCode.AUTH_INVALID_CREDENTIALS });
    });

    it('does not reveal whether an account exists (same code + message)', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      const missingError = await service
        .login({ identifier: 'ghost@email.com', password: 'StrongPass1!' })
        .catch((e) => e);

      prisma.user.findFirst.mockResolvedValueOnce(
        userMock({ passwordHash: await bcrypt.hash('StrongPass1!', 10) }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      const wrongError = await service
        .login({ identifier: 'arthur@email.com', password: 'WrongPass1!' })
        .catch((e) => e);

      expect(missingError.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      expect(missingError.code).toBe(wrongError.code);
      expect(missingError.message).toBe(wrongError.message);
    });

    it('throws AUTH_ACCOUNT_BLOCKED for a blocked account', async () => {
      prisma.user.findFirst.mockResolvedValue(
        userMock({ status: 'BLOCKED', passwordHash: await bcrypt.hash('StrongPass1!', 10) }),
      );
      await expect(
        service.login({ identifier: 'arthur@email.com', password: 'StrongPass1!' }),
      ).rejects.toMatchObject({ code: ErrorCode.AUTH_ACCOUNT_BLOCKED });
    });

    it('locks the account after repeated failures', async () => {
      prisma.user.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      [0, 1, 2, 3].forEach((n) =>
        prisma.user.findFirst.mockResolvedValueOnce(
          userMock({ passwordHash: 'salted-hash', failedLoginAttempts: n }),
        ),
      );
      prisma.user.findFirst.mockResolvedValue(
        userMock({ passwordHash: 'salted-hash', failedLoginAttempts: 4 }),
      );

      for (let i = 0; i < 5; i += 1) {
        await expect(
          service.login({ identifier: 'arthur@email.com', password: 'WrongPass1!' }),
        ).rejects.toMatchObject({ code: ErrorCode.AUTH_INVALID_CREDENTIALS });
      }

      const updateData = prisma.user.update.mock.calls[4][0].data;
      expect(updateData.blockedUntil).toEqual(expect.any(Date));
      expect(updateData.failedLoginAttempts).toBe(0);
    });

    it('rejects logins while the lockout period is active', async () => {
      prisma.user.findFirst.mockResolvedValue(
        userMock({
          passwordHash: 'salted-hash',
          blockedUntil: new Date(Date.now() + 60_000),
        }),
      );
      await expect(
        service.login({ identifier: 'arthur@email.com', password: 'StrongPass1!' }),
      ).rejects.toMatchObject({
        code: ErrorCode.AUTH_ACCOUNT_BLOCKED,
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });
  });

  describe('refresh', () => {
    it('rotates a valid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt_1',
        expiresAt: new Date(Date.now() + 100_000),
        userId: 'user_1',
        user: userMock(),
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const tokens = await service.refreshTokens('refresh_token_1');

      expect(tokens.accessToken).toBe('access_user');
      expect(tokens.refreshToken).toBe('refresh_user');
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt_1' },
      });
    });

    it('throws AUTH_INVALID_REFRESH_TOKEN for unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refreshTokens('nope')).rejects.toMatchObject({
        code: ErrorCode.AUTH_INVALID_REFRESH_TOKEN,
      });
    });

    it('throws AUTH_INVALID_REFRESH_TOKEN for an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt_1',
        expiresAt: new Date(Date.now() - 1000),
        userId: 'user_1',
        user: userMock(),
      });
      await expect(service.refreshTokens('expired')).rejects.toMatchObject({
        code: ErrorCode.AUTH_INVALID_REFRESH_TOKEN,
      });
    });

    it('throws AUTH_ACCOUNT_BLOCKED for a blocked user session', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt_1',
        expiresAt: new Date(Date.now() + 100_000),
        userId: 'user_1',
        user: userMock({ status: 'BLOCKED' }),
      });
      await expect(service.refreshTokens('ok')).rejects.toMatchObject({
        code: ErrorCode.AUTH_ACCOUNT_BLOCKED,
      });
    });
  });

  describe('logout', () => {
    it('deletes the refresh token', async () => {
      await service.logout('refresh_token_1');
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'refresh_token_1' },
      });
    });
  });

  describe('checkUsername', () => {
    it('returns available=true for a free username', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      expect(await service.checkUsername('@arthur')).toEqual({
        success: true,
        username: 'arthur',
        available: true,
      });
    });

    it('returns available=false for a taken username', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user_1' });
      expect(await service.checkUsername('ARTHUR')).toEqual({
        success: true,
        username: 'arthur',
        available: false,
      });
    });

    it('returns available=false for invalid usernames', async () => {
      const result = await service.checkUsername('has space');
      expect(result.available).toBe(false);
    });
  });

  describe('forgotPassword', () => {
    it('always returns the same acknowledgment message', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.forgotPassword('ghost@email.com');
      expect(result.message).toContain(
        'Se existir uma conta associada a este e-mail',
      );
    });

    it('creates a single-use token for an existing account and sends mail', async () => {
      prisma.user.findUnique.mockResolvedValue(userMock());
      prisma.passwordResetToken.create.mockResolvedValue({});

      const result = await service.forgotPassword('arthur@email.com');

      expect(result.success).toBe(true);
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    });

    it('does not create tokens for blocked accounts (no enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(userMock({ status: 'BLOCKED' }));
      const result = await service.forgotPassword('arthur@email.com');
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('throws AUTH_PASSWORD_MISMATCH when confirmations differ', async () => {
      await expect(
        service.resetPassword({
          token: 'x',
          password: 'NewPass1!',
          passwordConfirmation: 'Different1!',
        }),
      ).rejects.toMatchObject({ code: ErrorCode.AUTH_PASSWORD_MISMATCH });
    });

    it('throws AUTH_WEAK_PASSWORD for weak new password', async () => {
      await expect(
        service.resetPassword({
          token: 'x',
          password: 'weak',
          passwordConfirmation: 'weak',
        }),
      ).rejects.toMatchObject({ code: ErrorCode.AUTH_WEAK_PASSWORD });
    });

    it('throws AUTH_RESET_TOKEN_INVALID for unknown/used/expired tokens', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      await expect(
        service.resetPassword({
          token: 'nope',
          password: 'NewPass1!',
          passwordConfirmation: 'NewPass1!',
        }),
      ).rejects.toMatchObject({ code: ErrorCode.AUTH_RESET_TOKEN_INVALID });
    });

    it('updates the password, marks token used and kills old sessions', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt_1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
        userId: 'user_1',
        user: userMock(),
      });
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.resetPassword({
        token: 'valid-token',
        password: 'NewPass1!',
        passwordConfirmation: 'NewPass1!',
      });

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('returns a sanitized user without sensitive fields', async () => {
      prisma.user.findUnique.mockResolvedValue(userMock());
      const profile = await service.getProfile('user_1');
      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile).not.toHaveProperty('cpf');
      expect(profile).not.toHaveProperty('failedLoginAttempts');
    });
  });
});