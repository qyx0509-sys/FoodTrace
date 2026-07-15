import { ApiError } from './http-client';
import type { HttpClient } from './http-client';

export type ExistingRecordStatus = 'WANT_TO_GO' | 'VISITED' | 'BLACKLISTED';

export interface PoiSearchItem {
  address: string;
  category: string | null;
  city: string;
  coordinateType: 'GCJ02';
  distanceMeters: number | null;
  district: string;
  existingRecord: {
    id: string;
    status: ExistingRecordStatus;
  } | null;
  latitude: number;
  longitude: number;
  name: string;
  phone: string | null;
  province: string;
  provider: 'TENCENT';
  providerPoiId: string;
}

export interface PoiSearchParameters {
  city?: string;
  keyword: string;
  latitude?: number;
  limit?: number;
  longitude?: number;
  page?: number;
  radiusMeters?: number;
}

interface PoiSearchCollection {
  items: PoiSearchItem[];
}

interface PoiRequester {
  request<T>(options: { path: string }): Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExistingRecordStatus(value: unknown): value is ExistingRecordStatus {
  return value === 'WANT_TO_GO' || value === 'VISITED' || value === 'BLACKLISTED';
}

function isPoiSearchItem(value: unknown): value is PoiSearchItem {
  if (!isRecord(value)) {
    return false;
  }

  const existingRecord = value['existingRecord'];
  const hasValidExistingRecord =
    existingRecord === null ||
    (isRecord(existingRecord) &&
      typeof existingRecord['id'] === 'string' &&
      isExistingRecordStatus(existingRecord['status']));

  return (
    value['provider'] === 'TENCENT' &&
    typeof value['providerPoiId'] === 'string' &&
    typeof value['name'] === 'string' &&
    (typeof value['category'] === 'string' || value['category'] === null) &&
    typeof value['address'] === 'string' &&
    typeof value['province'] === 'string' &&
    typeof value['city'] === 'string' &&
    typeof value['district'] === 'string' &&
    (typeof value['phone'] === 'string' || value['phone'] === null) &&
    typeof value['latitude'] === 'number' &&
    typeof value['longitude'] === 'number' &&
    value['coordinateType'] === 'GCJ02' &&
    (typeof value['distanceMeters'] === 'number' || value['distanceMeters'] === null) &&
    hasValidExistingRecord
  );
}

export function buildPoiSearchPath(parameters: PoiSearchParameters): string {
  const query: Array<[string, string]> = [['keyword', parameters.keyword.trim()]];

  const city = parameters.city?.trim();
  if (city !== undefined && city.length > 0) {
    query.push(['city', city]);
  }
  if (parameters.latitude !== undefined && parameters.longitude !== undefined) {
    query.push(['latitude', String(parameters.latitude)]);
    query.push(['longitude', String(parameters.longitude)]);
  }
  query.push(['radiusMeters', String(parameters.radiusMeters ?? 5_000)]);
  query.push(['page', String(parameters.page ?? 1)]);
  query.push(['limit', String(parameters.limit ?? 20)]);
  const encodedQuery = query
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `/pois/search?${encodedQuery}`;
}

export function parsePoiSearchResponse(value: unknown): PoiSearchItem[] {
  const candidateItems: unknown = isRecord(value) && 'items' in value ? value['items'] : value;
  if (!Array.isArray(candidateItems)) {
    throw new ApiError('UNEXPECTED_RESPONSE', '店铺搜索响应格式不正确', 0);
  }

  const items = candidateItems as unknown[];
  if (!items.every(isPoiSearchItem)) {
    throw new ApiError('UNEXPECTED_RESPONSE', '店铺搜索响应格式不正确', 0);
  }
  return items;
}

export class PoiService {
  constructor(private readonly requester: PoiRequester | Pick<HttpClient, 'request'>) {}

  async search(parameters: PoiSearchParameters): Promise<PoiSearchItem[]> {
    const response = await this.requester.request<PoiSearchItem[] | PoiSearchCollection>({
      path: buildPoiSearchPath(parameters),
    });
    return parsePoiSearchResponse(response);
  }
}
