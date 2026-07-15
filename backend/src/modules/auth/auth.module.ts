import { Module } from '@nestjs/common';

import { SensitiveRouteRateLimitGuard } from '../../common/security/rate-limit.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtTokenService } from './jwt-token.service';
import { WeChatAuthClient } from './wechat-auth.client';

@Module({
  controllers: [AuthController],
  exports: [JwtAuthGuard, JwtTokenService],
  providers: [
    AuthService,
    JwtAuthGuard,
    JwtTokenService,
    SensitiveRouteRateLimitGuard,
    WeChatAuthClient,
  ],
})
export class AuthModule {}
