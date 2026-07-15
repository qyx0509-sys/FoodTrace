import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SensitiveRouteRateLimitGuard } from '../../common/security/rate-limit.guard';
import { AuthService, type SessionResponse } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { RefreshTokenDto, WeChatMiniLoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('wechat/mini/login')
  @HttpCode(200)
  @UseGuards(SensitiveRouteRateLimitGuard)
  @ApiOperation({ summary: '使用一次性 wx.login code 登录' })
  login(@Body() dto: WeChatMiniLoginDto): Promise<SessionResponse> {
    return this.auth.loginWithMiniProgram(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(SensitiveRouteRateLimitGuard)
  @ApiOperation({ summary: '轮换刷新令牌并签发新会话令牌' })
  refresh(@Body() dto: RefreshTokenDto): Promise<SessionResponse> {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '撤销当前设备会话' })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.logout(user);
  }
}
