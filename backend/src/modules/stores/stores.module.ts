import { Module } from '@nestjs/common';

import { SensitiveRouteRateLimitGuard } from '../../common/security/rate-limit.guard';
import { AuthModule } from '../auth/auth.module';
import { PoiService } from './poi.service';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { TencentMapClient } from './tencent-map.client';

@Module({
  controllers: [StoresController],
  imports: [AuthModule],
  providers: [
    PoiService,
    SensitiveRouteRateLimitGuard,
    StoresService,
    TencentMapClient,
  ],
})
export class StoresModule {}
