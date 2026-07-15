import { describe, expect, it } from 'vitest';

import { ApiError } from '../miniprogram/api/http-client';
import {
  buildPoiSearchPath,
  parsePoiSearchResponse,
  type PoiSearchItem,
} from '../miniprogram/api/poi-service';
import {
  formatDistance,
  getSearchErrorMessage,
  isLocationPermissionDenied,
  normalizeRecentKeywords,
  prependRecentKeyword,
  toPoiSearchViews,
  validateCity,
  validateSearchKeyword,
} from '../miniprogram/features/poi-search/search-state';

const poi: PoiSearchItem = {
  address: '测试路 1 号',
  category: '美食:中餐',
  city: '上海市',
  coordinateType: 'GCJ02',
  distanceMeters: 860,
  district: '黄浦区',
  existingRecord: null,
  latitude: 31.2304,
  longitude: 121.4737,
  name: '测试餐厅',
  phone: null,
  province: '上海市',
  provider: 'TENCENT',
  providerPoiId: 'poi-1',
};

describe('poi search contract', () => {
  it('encodes the approved POI query contract', () => {
    expect(
      buildPoiSearchPath({
        keyword: ' 本帮 菜 ',
        latitude: 31.2304,
        longitude: 121.4737,
      }),
    ).toBe(
      '/pois/search?keyword=%E6%9C%AC%E5%B8%AE%20%E8%8F%9C&latitude=31.2304&longitude=121.4737&radiusMeters=5000&page=1&limit=20',
    );
  });

  it('accepts both array and item collection responses', () => {
    expect(parsePoiSearchResponse([poi])).toEqual([poi]);
    expect(parsePoiSearchResponse({ items: [poi] })).toEqual([poi]);
  });

  it('supports the approved city fallback when location is unavailable', () => {
    expect(buildPoiSearchPath({ city: ' 上海市 ', keyword: '小馆' })).toBe(
      '/pois/search?keyword=%E5%B0%8F%E9%A6%86&city=%E4%B8%8A%E6%B5%B7%E5%B8%82&radiusMeters=5000&page=1&limit=20',
    );
  });

  it('rejects malformed upstream data instead of showing fake empty results', () => {
    expect(() => parsePoiSearchResponse({ items: [{ name: '缺字段' }] })).toThrow(
      '店铺搜索响应格式不正确',
    );
  });
});

describe('poi search view state', () => {
  it('validates the keyword length after trimming', () => {
    expect(validateSearchKeyword(' ')).toMatchObject({ valid: false });
    expect(validateSearchKeyword('店')).toMatchObject({
      message: '至少输入 2 个字',
      valid: false,
    });
    expect(validateSearchKeyword(' 小馆 ')).toEqual({
      message: '',
      normalizedKeyword: '小馆',
      valid: true,
    });
    expect(validateSearchKeyword('食'.repeat(51))).toMatchObject({
      message: '最多输入 50 个字',
      valid: false,
    });
  });

  it('formats real result fields without inventing ratings or prices', () => {
    expect(toPoiSearchViews([poi])).toEqual([
      {
        address: '测试路 1 号',
        categoryLabel: '中餐',
        distanceLabel: '860米',
        existingRecordLabel: '',
        hasExistingRecord: false,
        mapPoiId: 'poi-1',
        name: '测试餐厅',
      },
    ]);
    expect(formatDistance(1_250)).toBe('1.3公里');
    expect(formatDistance(null)).toBe('');
  });

  it('validates the city fallback independently of location permission', () => {
    expect(validateCity('')).toMatchObject({
      message: '请输入城市或行政区',
      valid: false,
    });
    expect(validateCity('沪')).toMatchObject({
      message: '城市名称至少 2 个字',
      valid: false,
    });
    expect(validateCity(' 上海市 ')).toEqual({
      message: '',
      normalizedCity: '上海市',
      valid: true,
    });
  });

  it('normalizes recent keywords without accepting malformed cache data', () => {
    expect(normalizeRecentKeywords('not-an-array')).toEqual([]);
    expect(
      normalizeRecentKeywords([' 小馆 ', 1, '小馆', '店', '面馆', '火锅', '烧烤', '咖啡', '甜品']),
    ).toEqual(['小馆', '面馆', '火锅', '烧烤', '咖啡']);
    expect(prependRecentKeyword(['小馆', '面馆'], '面馆')).toEqual(['面馆', '小馆']);
  });

  it('maps network and rate-limit failures to friendly messages', () => {
    expect(getSearchErrorMessage(new ApiError('NETWORK_ERROR', 'request:fail', 0))).toBe(
      '网络开小差了，请检查连接后重试。',
    );
    expect(getSearchErrorMessage(new ApiError('POI_RATE_LIMITED', 'rate limited', 429))).toBe(
      '搜索有点频繁，请稍后再试。',
    );
  });

  it('recognizes denied location permission errors', () => {
    expect(isLocationPermissionDenied('getLocation:fail auth deny')).toBe(true);
    expect(isLocationPermissionDenied('getLocation:fail system error')).toBe(false);
  });
});
