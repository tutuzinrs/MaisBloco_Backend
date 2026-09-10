import {
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { decode } from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/errors/api-error';
import { ErrorCode } from '../common/errors/error-codes';
import { MailService } from '../common/mail/mail.service';
import {
  isValidCpf,
  normalizeCpf,
} from '../common/validators/cpf';
import {
  isValidBrazilianPhone,
  maskPhone,
  normalizePhone,
} from '../common/validators/phone';
import { isValidBirthDate, MIN_AGE } from '../common/validators/birth-date';
import { isStrongPassword } from '../common/validators/password';
import { normalizeEmail, isValidEmail } from '../common/validators/email';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SocialAuthDto } from './dto/social-auth.dto';
import {
  AuthTokens,
  RequestContext,
  SafeUser,
} from './interfaces/auth.types';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;
const PASSWORD_RESET_TTL_MINUTES = 60;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const USERNAME_REGEX = /^[a-z0-9_.]{3,30}$/;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(
    dto: RegisterDto,
    context: RequestContext = {},
  ): Promise<{ user: SafeUser } & AuthTokens> {
    const name = dto.name.trim().replace(/\s+/g, ' ');
    const nickname = dto.nickname?.trim().replace(/\s+/g, ' ') || null;
    const username = dto.username.trim().toLowerCase().replace(/^@/, '');
    const email = normalizeEmail(dto.email);
    const cpf = normalizeCpf(dto.cpf);
    const phone = normalizePhone(dto.phone);
    const birthDate = new Date(dto.birthDate);

    this.assertValidRegistration({
      name,
      nickname,
      username,
      email,
      cpf,
      phone,
      birthDate,
      password: dto.password,
      passwordConfirmation: dto.passwordConfirmation,
    });

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }, { cpf }, { phone }],
      },
      select: { id: true, email: true, username: true, cpf: true, phone: true },
    });

    if (existing) {
      this.throwConflicts(existing, { email, username, cpf, phone });
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          name,
          nickname,
          username,
          email,
          cpf,
          phone,
          birthDate,
          passwordHash,
          authProvider: AuthProvider.LOCAL,
        },
      });
    } catch (error) {
      throw this.mapCreateError(error);
    }

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken, context);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(
    dto: LoginDto,
    context: RequestContext = {},
  ): Promise<{ user: SafeUser } & AuthTokens> {
    const identifier =
      dto.identifier.trim().toLowerCase().replace(/^@/, '');

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user || !user.passwordHash) {
      throw this.invalidCredentials();
    }

    this.assertUserActive(user);

    if (user.blockedUntil && user.blockedUntil > new Date()) {
      throw new ApiError(
        ErrorCode.AUTH_ACCOUNT_BLOCKED,
        'Muitas tentativas de login. Tente novamente em alguns minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      throw this.invalidCredentials();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        blockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken, context);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async socialAuth(
    dto: SocialAuthDto,
    context: RequestContext = {},
  ): Promise<{ user: SafeUser } & AuthTokens> {
    const profile = await this.verifySocialToken(dto);
    const provider = dto.provider === 'apple' ? AuthProvider.APPLE : AuthProvider.GOOGLE;

    let user = await this.prisma.user.findFirst({
      where: { authProvider: provider, authProviderId: profile.sub },
    });

    if (!user && profile.email) {
      user = await this.prisma.user.findUnique({
        where: { email: normalizeEmail(profile.email) },
      });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            authProvider: provider,
            authProviderId: profile.sub,
            avatar: profile.picture ?? user.avatar,
            name: profile.name ?? user.name,
          },
        });
      }
    }

    if (!user) {
      const base =
        profile.email?.split('@')[0] ??
        dto.name?.toLowerCase().replace(/\s+/g, '') ??
        `${dto.provider}_${Date.now()}`;
      const uniqueUsername = await this.generateUniqueUsername(base);

      user = await this.prisma.user.create({
        data: {
          name:
            profile.name ?? dto.name ?? profile.email?.split('@')[0] ?? 'User',
          username: uniqueUsername,
          email: profile.email
            ? normalizeEmail(profile.email)
            : `${dto.provider}_${profile.sub}@social.local`,
          avatar: profile.picture ?? dto.avatar,
          authProvider: provider,
          authProviderId: profile.sub,
        },
      });
    }

    this.assertUserActive(user);

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken, context);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refreshTokens(
    refreshToken: string,
    context: RequestContext = {},
  ): Promise<AuthTokens> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!record || record.expiresAt <= new Date()) {
      throw new ApiError(
        ErrorCode.AUTH_INVALID_REFRESH_TOKEN,
        'Sua sessão expirou. Entre novamente para continuar.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.assertUserActive(record.user);

    await this.prisma.refreshToken.delete({ where: { id: record.id } });

    const tokens = await this.generateTokens(record.user);
    await this.saveRefreshToken(record.user.id, tokens.refreshToken, context);

    return tokens;
  }

  async logout(refreshToken: string): Promise<{ success: true; message: string }> {
    await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return { success: true, message: 'Você saiu da sua conta.' };
  }

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.sanitizeUser(user);
  }

  async checkUsername(raw: string) {
    const username = (raw ?? '').trim().toLowerCase().replace(/^@/, '');
    if (!USERNAME_REGEX.test(username)) {
      return { success: true, username, available: false };
    }
    const existing = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    return { success: true, username, available: !existing };
  }

  async forgotPassword(emailRaw: string) {
    const email = normalizeEmail(emailRaw);
    const acknowledged = {
      success: true,
      message:
        'Se existir uma conta associada a este e-mail, enviaremos instruções para redefinir sua senha.',
    };

    if (!isValidEmail(email)) {
      return acknowledged;
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      return acknowledged;
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000);

    await this.prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    await this.mailService.sendPasswordResetEmail(email, token);

    return acknowledged;
  }

  async resetPassword(dto: {
    token: string;
    password: string;
    passwordConfirmation: string;
  }) {
    if (dto.password !== dto.passwordConfirmation) {
      throw new ApiError(
        ErrorCode.AUTH_PASSWORD_MISMATCH,
        'As senhas não coincidem.',
      );
    }

    if (!isStrongPassword(dto.password)) {
      throw new ApiError(
        ErrorCode.AUTH_WEAK_PASSWORD,
        'A senha precisa ter pelo menos 8 caracteres, maiúsculas, minúsculas, números e ao menos um caractere especial.',
      );
    }

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (
      !record ||
      record.usedAt !== null ||
      record.expiresAt <= new Date()
    ) {
      throw new ApiError(
        ErrorCode.AUTH_RESET_TOKEN_INVALID,
        'Este link é inválido ou expirou. Solicite um novo.',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertUserActive(record.user);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.user.id },
        data: { passwordHash, failedLoginAttempts: 0, blockedUntil: null },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: record.user.id },
      }),
    ]);

    return {
      success: true,
      message: 'Senha alterada com sucesso. Faça login com sua nova senha.',
    };
  }

  // ---------------------------------------------------------------------------
  // Validation helpers
  // ---------------------------------------------------------------------------

  private assertValidRegistration(input: {
    name: string;
    nickname: string | null;
    username: string;
    email: string;
    cpf: string;
    phone: string;
    birthDate: Date;
    password: string;
    passwordConfirmation: string;
  }) {
    if (input.name.length < 3 || input.name.length > 100) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Seu nome deve ter entre 3 e 100 caracteres.',
      );
    }
    if (!USERNAME_REGEX.test(input.username)) {
      throw new ApiError(
        ErrorCode.AUTH_INVALID_USERNAME,
        'O nome de usuário pode conter apenas letras minúsculas, números, ponto e sublinhado (3 a 30 caracteres).',
      );
    }
    if (!isValidEmail(input.email)) {
      throw new ApiError(
        ErrorCode.AUTH_INVALID_EMAIL,
        'Digite um e-mail válido.',
      );
    }
    if (!isValidCpf(input.cpf)) {
      throw new ApiError(
        ErrorCode.AUTH_INVALID_CPF,
        'CPF inválido. Verifique os números digitados.',
      );
    }
    if (!isValidBrazilianPhone(input.phone)) {
      throw new ApiError(
        ErrorCode.AUTH_INVALID_PHONE,
        'Digite um telefone brasileiro válido com DDD.',
      );
    }
    if (!isValidBirthDate(input.birthDate)) {
      throw new ApiError(
        ErrorCode.AUTH_INVALID_BIRTH_DATE,
        `Você precisa ter pelo menos ${MIN_AGE} anos para criar uma conta.`,
      );
    }
    if (!isStrongPassword(input.password)) {
      throw new ApiError(
        ErrorCode.AUTH_WEAK_PASSWORD,
        'A senha precisa ter pelo menos 8 caracteres, maiúsculas, minúsculas, números e ao menos um caractere especial.',
      );
    }
    if (input.password !== input.passwordConfirmation) {
      throw new ApiError(
        ErrorCode.AUTH_PASSWORD_MISMATCH,
        'As senhas não coincidem.',
      );
    }
  }

  private assertUserActive(user: User) {
    if (user.status !== UserStatus.ACTIVE) {
      throw new ApiError(
        ErrorCode.AUTH_ACCOUNT_BLOCKED,
        'Sua conta está bloqueada. Entre em contato com o suporte do MaisBloco.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async handleFailedLogin(user: User) {
    const nextAttempts = user.failedLoginAttempts + 1;
    const data =
      nextAttempts >= MAX_FAILED_ATTEMPTS
        ? {
            failedLoginAttempts: 0,
            blockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
          }
        : { failedLoginAttempts: nextAttempts };

    await this.prisma.user.update({ where: { id: user.id }, data });
  }

  private invalidCredentials(): ApiError {
    return new ApiError(
      ErrorCode.AUTH_INVALID_CREDENTIALS,
      'E-mail/usuário ou senha incorretos.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  // ---------------------------------------------------------------------------
  // Duplicate detection
  // ---------------------------------------------------------------------------

  private throwConflicts(
    existing: ConflictSnapshot,
    incoming: ConflictSnapshot,
  ) {
    if (existing.email === incoming.email) {
      throw new ApiError(
        ErrorCode.AUTH_EMAIL_ALREADY_EXISTS,
        'Este e-mail já está cadastrado.',
        HttpStatus.CONFLICT,
      );
    }
    if (existing.username === incoming.username) {
      throw new ApiError(
        ErrorCode.AUTH_USERNAME_ALREADY_EXISTS,
        'Esse nome de usuário já está em uso.',
        HttpStatus.CONFLICT,
      );
    }
    if (existing.cpf === incoming.cpf) {
      throw new ApiError(
        ErrorCode.AUTH_CPF_ALREADY_EXISTS,
        'Este CPF já está cadastrado.',
        HttpStatus.CONFLICT,
      );
    }
    if (existing.phone === incoming.phone) {
      throw new ApiError(
        ErrorCode.AUTH_PHONE_ALREADY_EXISTS,
        'Este telefone já está cadastrado.',
        HttpStatus.CONFLICT,
      );
    }
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Já existe um cadastro com os dados informados.',
      HttpStatus.CONFLICT,
    );
  }

  private mapCreateError(error: unknown): Error {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      const target = (
        (error as { meta?: { target?: unknown } }).meta?.target as string[]
      ) ?? [];
      const field = target[0];
      if (field === 'email') {
        return new ApiError(
          ErrorCode.AUTH_EMAIL_ALREADY_EXISTS,
          'Este e-mail já está cadastrado.',
          HttpStatus.CONFLICT,
        );
      }
      if (field === 'username') {
        return new ApiError(
          ErrorCode.AUTH_USERNAME_ALREADY_EXISTS,
          'Esse nome de usuário já está em uso.',
          HttpStatus.CONFLICT,
        );
      }
      if (field === 'cpf') {
        return new ApiError(
          ErrorCode.AUTH_CPF_ALREADY_EXISTS,
          'Este CPF já está cadastrado.',
          HttpStatus.CONFLICT,
        );
      }
      if (field === 'phone') {
        return new ApiError(
          ErrorCode.AUTH_PHONE_ALREADY_EXISTS,
          'Este telefone já está cadastrado.',
          HttpStatus.CONFLICT,
        );
      }
      return new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Já existe um cadastro com os dados informados.',
        HttpStatus.CONFLICT,
      );
    }
    throw error;
  }

  // ---------------------------------------------------------------------------
  // Social token verification
  // ---------------------------------------------------------------------------

  private async verifySocialToken(dto: SocialAuthDto) {
    switch (dto.provider) {
      case 'google': {
        const res = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(dto.token)}`,
        );
        if (!res.ok) {
          throw new UnauthorizedException('Token do Google inválido.');
        }
        const info = (await res.json()) as {
          sub: string;
          email?: string;
          name?: string;
          picture?: string;
        };
        if (!info.sub) {
          throw new UnauthorizedException('Token do Google inválido.');
        }
        return {
          sub: info.sub,
          email: info.email,
          name: info.name,
          picture: info.picture,
        };
      }
      case 'apple': {
        const decoded = decode(dto.token) as { sub?: string; email?: string } | null;
        if (!decoded?.sub) {
          throw new UnauthorizedException('Token do Apple inválido.');
        }
        return {
          sub: decoded.sub,
          email: decoded.email,
          name: dto.name,
          picture: undefined,
        };
      }
      default:
        throw new UnauthorizedException('Provedor não suportado.');
    }
  }

  // ---------------------------------------------------------------------------
  // Tokens
  // ---------------------------------------------------------------------------

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: ACCESS_TOKEN_TTL }),
      this.jwtService.signAsync(payload, {
        expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(
    userId: string,
    token: string,
    context: RequestContext,
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
    });
  }

  private async generateUniqueUsername(base: string): Promise<string> {
    let username = base.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (username.length < 3) {
      username = `user_${username}`;
    }
    let counter = 0;

    while (true) {
      const candidate = counter === 0 ? username : `${username}${counter}`;
      const existing = await this.prisma.user.findUnique({
        where: { username: candidate },
      });
      if (!existing) {
        return candidate;
      }
      counter += 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  private sanitizeUser(user: User): SafeUser {
    return {
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      phone: user.phone ? maskPhone(user.phone) : null,
      birthDate: user.birthDate?.toISOString() ?? null,
      status: user.status,
      authProvider: user.authProvider,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

interface ConflictSnapshot {
  email?: string | null;
  username?: string | null;
  cpf?: string | null;
  phone?: string | null;
}