import { Controller, Post, Body, Get, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, SocialAuthDto, RefreshTokenDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface AuthRequest extends Request {
  user: { sub: string; email: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('social')
  @HttpCode(HttpStatus.OK)
  async socialAuth(@Body() dto: SocialAuthDto) {
    return this.authService.socialAuth(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: AuthRequest) {
    return this.authService.getProfile(req.user.sub);
  }
}
