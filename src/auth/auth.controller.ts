import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';

import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { Throttle } from '../common/rate-limit/rate-limit.decorator';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SocialAuthDto } from './dto/social-auth.dto';
import { CheckUsernameQueryDto } from './dto/check-username.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type {
  AuthenticatedUser,
  RequestContext,
} from './interfaces/auth.types';

type AuthRequest = Request & { user: AuthenticatedUser };

@UseInterceptors(RateLimitGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ limit: 5, ttlMs: 60_000 })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.context(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ limit: 10, ttlMs: 60_000 })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.context(req));
  }

  @Post('social')
  @HttpCode(HttpStatus.OK)
  @Throttle({ limit: 10, ttlMs: 60_000 })
  socialAuth(@Body() dto: SocialAuthDto, @Req() req: Request) {
    return this.authService.socialAuth(dto, this.context(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ limit: 30, ttlMs: 60_000 })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshTokens(dto.refreshToken, this.context(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ limit: 3, ttlMs: 300_000 })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ limit: 5, ttlMs: 60_000 })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('check-username')
  @Throttle({ limit: 60, ttlMs: 60_000 })
  checkUsername(@Query() query: CheckUsernameQueryDto) {
    return this.authService.checkUsername(query.username);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthRequest) {
    return this.authService.getProfile(req.user.sub);
  }

  // Kept as an alias for backward compatibility with the previous app build.
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Req() req: AuthRequest) {
    return this.authService.getProfile(req.user.sub);
  }

  private context(req: Request): RequestContext {
    return {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    };
  }
}