import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { PoiSearchQueryDto } from './dto/poi-query.dto';

interface TencentPoiRaw {
  _distance?: unknown;
  ad_info?: {
    city?: unknown;
    district?: unknown;
    province?: unknown;
  };
  address?: unknown;
  category?: unknown;
  id?: unknown;
  location?: { lat?: unknown; lng?: unknown };
  tel?: unknown;
  title?: unknown;
}

interface TencentResponse {
  count?: unknown;
  data?: unknown;
  message?: unknown;
  status?: unknown;
}

export interface TencentPoi {
  address: string;
  category: string | null;
  city: string;
  distanceMeters: number | null;
  district: string;
  latitude: number;
  longitude: number;
  name: string;
  phone: string | null;
  province: string;
  providerPoiId: string;
}

function toPoi(value: unknown): TencentPoi | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const item = value as TencentPoiRaw;
  if (
    typeof item.id !== 'string' ||
    typeof item.title !== 'string' ||
    typeof item.location?.lat !== 'number' ||
    typeof item.location.lng !== 'number'
  ) {
    return null;
  }
  return {
    address: typeof item.address === 'string' ? item.address : '',
    category: typeof item.category === 'string' ? item.category : null,
    city: typeof item.ad_info?.city === 'string' ? item.ad_info.city : '',
    distanceMeters: typeof item._distance === 'number' ? Math.round(item._distance) : null,
    district: typeof item.ad_info?.district === 'string' ? item.ad_info.district : '',
    latitude: item.location.lat,
    longitude: item.location.lng,
    name: item.title,
    phone: typeof item.tel === 'string' && item.tel.length > 0 ? item.tel : null,
    province: typeof item.ad_info?.province === 'string' ? item.ad_info.province : '',
    providerPoiId: item.id,
  };
}

@Injectable()
export class TencentMapClient {
  constructor(private readonly config: ConfigService) {}

  async search(query: PoiSearchQueryDto): Promise<{ items: TencentPoi[]; total: number }> {
    if ((query.latitude === undefined) !== (query.longitude === undefined)) {
      throw new BadRequestException({
        code: 'POI_COORDINATES_INCOMPLETE',
        message: '纬度和经度必须同时提供',
      });
    }
    const parameters = new URLSearchParams({
      key: this.getKey(),
      keyword: query.keyword,
      page_index: String(query.page),
      page_size: String(query.limit),
    });
    if (query.latitude !== undefined && query.longitude !== undefined) {
      parameters.set(
        'boundary',
        `nearby(${query.latitude},${query.longitude},${query.radiusMeters},1)`,
      );
    } else if (query.city !== undefined) {
      parameters.set('boundary', `region(${query.city},1)`);
    } else {
      throw new ServiceUnavailableException({
        code: 'POI_SCOPE_REQUIRED',
        message: '请选择城市或允许使用当前位置',
      });
    }
    const response = await this.request(
      `https://apis.map.qq.com/ws/place/v1/search?${parameters.toString()}`,
    );
    const rawItems = Array.isArray(response.data) ? response.data : [];
    return {
      items: rawItems.map(toPoi).filter((item): item is TencentPoi => item !== null),
      total: typeof response.count === 'number' ? response.count : 0,
    };
  }

  async getDetail(providerPoiId: string): Promise<TencentPoi> {
    const parameters = new URLSearchParams({ id: providerPoiId, key: this.getKey() });
    const response = await this.request(
      `https://apis.map.qq.com/ws/place/v1/detail?${parameters.toString()}`,
    );
    const poi = toPoi(response.data);
    if (poi === null) {
      throw new NotFoundException({ code: 'POI_NOT_FOUND', message: '店铺地点信息不存在' });
    }
    return poi;
  }

  private getKey(): string {
    const key = this.config.get<string>('TENCENT_MAP_WEB_SERVICE_KEY');
    if (key === undefined || key.trim().length === 0 || key.includes('REPLACE_ME')) {
      throw new ServiceUnavailableException({
        code: 'MAP_NOT_CONFIGURED',
        message: '当前环境尚未配置餐厅搜索服务',
      });
    }
    return key;
  }

  private async request(url: string): Promise<TencentResponse> {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    } catch {
      throw new BadGatewayException({ code: 'MAP_UNAVAILABLE', message: '餐厅搜索服务暂时不可用' });
    }
    if (!response.ok) {
      throw new BadGatewayException({ code: 'MAP_UNAVAILABLE', message: '餐厅搜索服务响应异常' });
    }
    const value = (await response.json()) as TencentResponse;
    if (value.status !== 0) {
      throw new BadGatewayException({
        code: 'MAP_UPSTREAM_ERROR',
        message: '餐厅搜索失败，请稍后重试',
      });
    }
    return value;
  }
}
