import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MailService } from '../common/mail/mail.service';
import { RateLimitService } from '../common/rate-limit/rate-limit.guard';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET') || 'maisbloco-secret-key',
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ||
            '15m') as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, MailService, RateLimitService],
  exports: [AuthService, JwtModule, PassportModule, JwtStrategy],
})
export class AuthModule {}