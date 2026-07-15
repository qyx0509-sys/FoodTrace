import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { WeChatIdentity } from './auth.types';

interface WeChatSessionResponse {
  errcode?: unknown;
  errmsg?: unknown;
  openid?: unknown;
  unionid?: unknown;
}

@Injectable()
export class WeChatAuthClient {
  constructor(private readonly config: ConfigService) {}

  async exchangeMiniCode(code: string): Promise<WeChatIdentity> {
    if (!this.config.getOrThrow<boolean>('WECHAT_MINI_LOGIN_ENABLED')) {
      throw new ServiceUnavailableException({
        code: 'WECHAT_LOGIN_DISABLED',
        message: '微信登录尚未在当前环境启用',
      });
    }
    const appId = this.config.getOrThrow<string>('WECHAT_MINI_APP_ID');
    const secret = this.config.getOrThrow<string>('WECHAT_MINI_APP_SECRET');
    const query = new URLSearchParams({
      appid: appId,
      grant_type: 'authorization_code',
      js_code: code,
      secret,
    });

    let response: Response;
    try {
      response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`, {
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new BadGatewayException({ code: 'WECHAT_UNAVAILABLE', message: '微信登录服务暂时不可用' });
    }
    if (!response.ok) {
      throw new BadGatewayException({ code: 'WECHAT_UNAVAILABLE', message: '微信登录服务响应异常' });
    }
    const value = (await response.json()) as WeChatSessionResponse;
    if (typeof value.errcode === 'number') {
      if (value.errcode === 40029 || value.errcode === 40163) {
        throw new UnauthorizedException({ code: 'WECHAT_CODE_INVALID', message: '微信登录凭证已失效' });
      }
      throw new BadGatewayException({ code: 'WECHAT_LOGIN_FAILED', message: '微信登录失败，请稍后重试' });
    }
    if (typeof value.openid !== 'string' || value.openid.length === 0) {
      throw new BadGatewayException({ code: 'WECHAT_RESPONSE_INVALID', message: '微信登录响应不完整' });
    }
    return {
      openId: value.openid,
      unionId: typeof value.unionid === 'string' ? value.unionid : null,
    };
  }
}
