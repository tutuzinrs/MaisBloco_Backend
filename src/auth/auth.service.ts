import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { decode } from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, SocialAuthDto } from './dto/register.dto';
import { AuthProvider } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Email or username already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        phone: dto.phone,
        authProvider: AuthProvider.LOCAL,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async socialAuth(dto: SocialAuthDto) {
    const profile = await this.verifySocialToken(dto);

    let user = await this.prisma.user.findFirst({
      where: {
        authProvider: dto.provider.toUpperCase() as AuthProvider,
        authProviderId: profile.sub,
      },
    });

    if (!user && profile.email) {
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            authProvider: dto.provider.toUpperCase() as AuthProvider,
            authProviderId: profile.sub,
            avatar: profile.picture ?? user.avatar,
            name: profile.name ?? user.name,
          },
        });
      }
    }

    if (!user) {
      const base =
        profile.email?.split('@')[0] ||
        dto.name?.toLowerCase().replace(/\s+/g, '') ||
        `${dto.provider}_${Date.now()}`;

      const uniqueUsername = await this.generateUniqueUsername(base);

      user = await this.prisma.user.create({
        data: {
          name: profile.name || dto.name || profile.email?.split('@')[0] || 'User',
          username: uniqueUsername,
          email: profile.email || `${dto.provider}_${profile.sub}@social.local`,
          avatar: profile.picture ?? dto.avatar,
          authProvider: dto.provider.toUpperCase() as AuthProvider,
          authProviderId: profile.sub,
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Verifies the provider token and extracts a stable profile (sub/email/name/picture).
   * Google: validates the id token against Google's tokeninfo endpoint.
   * Apple: decodes the identity token claims (sub/email). In production, verify the
   * signature against Apple's public keys at https://appleid.apple.com/auth/keys.
   */
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
        const decoded = decode(dto.token) as {
          sub?: string;
          email?: string;
        } | null;
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

  async refreshTokens(refreshToken: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({
      where: { id: tokenRecord.id },
    });

    const tokens = await this.generateTokens(
      tokenRecord.userId,
      tokenRecord.user.email,
    );
    await this.saveRefreshToken(tokenRecord.userId, tokens.refreshToken);

    return tokens;
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeUser(user);
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, { expiresIn: '7d' }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  private async generateUniqueUsername(base: string): Promise<string> {
    let username = base.toLowerCase().replace(/[^a-z0-9_]/g, '');
    let counter = 0;

    while (true) {
      const existing = await this.prisma.user.findUnique({
        where: { username: counter === 0 ? username : `${username}${counter}` },
      });

      if (!existing) {
        return counter === 0 ? username : `${username}${counter}`;
      }

      counter++;
    }
  }

  private sanitizeUser(user: any) {
    const { password: _password, ...rest } = user;
    return rest;
  }
}
