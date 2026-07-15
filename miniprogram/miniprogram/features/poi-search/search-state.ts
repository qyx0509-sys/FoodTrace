import { ApiError } from '../../api/http-client';
import type { ExistingRecordStatus, PoiSearchItem } from '../../api/poi-service';

export type SearchStatus = 'idle' | 'loading' | 'results' | 'empty' | 'error';
export type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';
export type SearchScopeMode = 'location' | 'city';

export interface KeywordValidation {
  message: string;
  normalizedKeyword: string;
  valid: boolean;
}

export interface PoiSearchView {
  address: string;
  categoryLabel: string;
  distanceLabel: string;
  existingRecordLabel: string;
  hasExistingRecord: boolean;
  existingRecordId: string | null;
  mapPoiId: string;
  name: string;
}

export interface ScopeValidation {
  message: string;
  normalizedCity: string;
  valid: boolean;
}

const existingRecordLabels: Record<ExistingRecordStatus, string> = {
  BLACKLISTED: '已在黑名单',
  VISITED: '已打卡',
  WANT_TO_GO: '已想去',
};

const maxRecentKeywords = 5;

export function validateSearchKeyword(keyword: string): KeywordValidation {
  const normalizedKeyword = keyword.trim();
  if (normalizedKeyword.length === 0) {
    return { message: '', normalizedKeyword, valid: false };
  }
  if (normalizedKeyword.length < 2) {
    return { message: '至少输入 2 个字', normalizedKeyword, valid: false };
  }
  if (normalizedKeyword.length > 50) {
    return { message: '最多输入 50 个字', normalizedKeyword, valid: false };
  }
  return { message: '', normalizedKeyword, valid: true };
}

export function validateCity(city: string): ScopeValidation {
  const normalizedCity = city.trim();
  if (normalizedCity.length === 0) {
    return { message: '请输入城市或行政区', normalizedCity, valid: false };
  }
  if (normalizedCity.length < 2) {
    return { message: '城市名称至少 2 个字', normalizedCity, valid: false };
  }
  if (normalizedCity.length > 20) {
    return { message: '城市名称最多 20 个字', normalizedCity, valid: false };
  }
  return { message: '', normalizedCity, valid: true };
}

export function normalizeRecentKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const keywords: string[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'string') {
      continue;
    }
    const validation = validateSearchKeyword(item);
    if (!validation.valid || keywords.includes(validation.normalizedKeyword)) {
      continue;
    }
    keywords.push(validation.normalizedKeyword);
    if (keywords.length === maxRecentKeywords) {
      break;
    }
  }
  return keywords;
}

export function prependRecentKeyword(existing: string[], keyword: string): string[] {
  return normalizeRecentKeywords([keyword, ...existing]);
}

export function formatDistance(distanceMeters: number | null): string {
  if (distanceMeters === null || distanceMeters < 0) {
    return '';
  }
  if (distanceMeters < 1_000) {
    return `${Math.round(distanceMeters)}米`;
  }
  const distanceKilometers = distanceMeters / 1_000;
  return `${distanceKilometers >= 10 ? distanceKilometers.toFixed(0) : distanceKilometers.toFixed(1)}公里`;
}

export function toPoiSearchViews(items: PoiSearchItem[]): PoiSearchView[] {
  return items.map((item) => {
    const categoryParts = item.category?.split(':').filter((part) => part.trim().length > 0) ?? [];
    return {
      address: item.address || [item.district, item.city].filter(Boolean).join(' '),
      categoryLabel: categoryParts.at(-1) ?? '餐饮店铺',
      distanceLabel: formatDistance(item.distanceMeters),
      existingRecordLabel:
        item.existingRecord === null ? '' : existingRecordLabels[item.existingRecord.status],
      existingRecordId: item.existingRecord?.id ?? null,
      hasExistingRecord: item.existingRecord !== null,
      mapPoiId: item.providerPoiId,
      name: item.name,
    };
  });
}

export function getSearchErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '搜索暂时不可用，请稍后重试。';
  }

  switch (error.code) {
    case 'AUTH_REQUIRED':
      return '请先完成微信登录，再搜索店铺。';
    case 'NETWORK_ERROR':
      return '网络开小差了，请检查连接后重试。';
    case 'POI_RATE_LIMITED':
      return '搜索有点频繁，请稍后再试。';
    case 'POI_UPSTREAM_TIMEOUT':
      return '地图服务响应较慢，请稍后重试。';
    default:
      return error.message || '搜索暂时不可用，请稍后重试。';
  }
}

export function isLocationPermissionDenied(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('auth deny') ||
    normalized.includes('auth denied') ||
    normalized.includes('authorize:fail') ||
    normalized.includes('permission denied')
  );
}
