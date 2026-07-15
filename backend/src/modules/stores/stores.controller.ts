import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SensitiveRouteRateLimitGuard } from '../../common/security/rate-limit.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoiSearchQueryDto } from './dto/poi-query.dto';
import { CreateManualStoreDto, CreateTencentStoreDto } from './dto/store.dto';
import { PoiService } from './poi.service';
import { StoresService } from './stores.service';

@ApiTags('stores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class StoresController {
  constructor(
    private readonly stores: StoresService,
    private readonly pois: PoiService,
  ) {}

  @Get('pois/search')
  @UseGuards(SensitiveRouteRateLimitGuard)
  @ApiOperation({ summary: '通过腾讯位置服务搜索餐厅，不持久化普通搜索结果' })
  searchPois(
    @CurrentUser() auth: AuthenticatedUser,
    @Query() query: PoiSearchQueryDto,
  ): ReturnType<PoiService['search']> {
    return this.pois.search(auth.userId, query);
  }

  @Post('stores/manual')
  @ApiOperation({ summary: '创建当前用户的手动店铺' })
  createManual(
    @CurrentUser() auth: AuthenticatedUser,
    @Body() dto: CreateManualStoreDto,
  ): ReturnType<StoresService['createManual']> {
    return this.stores.createManual(auth.userId, dto);
  }

  @Post('stores/tencent')
  @ApiOperation({ summary: '由服务端重新读取腾讯 POI 并保存私人店铺快照' })
  createTencent(
    @CurrentUser() auth: AuthenticatedUser,
    @Body() dto: CreateTencentStoreDto,
  ): ReturnType<StoresService['createTencent']> {
    return this.stores.createTencent(auth.userId, dto);
  }

  @Get('stores/:id')
  @ApiOperation({ summary: '获取当前用户的店铺详情' })
  getOne(
    @CurrentUser() auth: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): ReturnType<StoresService['getOne']> {
    return this.stores.getOne(auth.userId, id);
  }
}
