import { createApiClient } from '../../api/api-client';
import { PoiService } from '../../api/poi-service';
import { StoreService } from '../../api/store-service';
import type { FoodTraceGlobalData } from '../../app';
import {
  getSearchErrorMessage,
  isLocationPermissionDenied,
  normalizeRecentKeywords,
  prependRecentKeyword,
  toPoiSearchViews,
  validateCity,
  validateSearchKeyword,
  type LocationStatus,
  type PoiSearchView,
  type SearchScopeMode,
  type SearchStatus,
} from '../../features/poi-search/search-state';

interface SearchPageData {
  city: string;
  errorMessage: string;
  latitude: number | null;
  locationMessage: string;
  locationStatus: LocationStatus;
  longitude: number | null;
  query: string;
  recentKeywords: string[];
  results: PoiSearchView[];
  scopeMode: SearchScopeMode;
  status: SearchStatus;
  validationMessage: string;
  loadingRows: number[];
}

interface TextInputEvent extends WechatMiniprogram.BaseEvent {
  detail: {
    value: string;
  };
}

interface SearchPageCustomOption {
  executeSearch(): Promise<void>;
  hasValidScope(): boolean;
  loadLocation(): void;
  onCityInput(event: TextInputEvent): void;
  onClear(): void;
  onInput(event: TextInputEvent): void;
  onManualAdd(): void;
  onOpenSettings(): void;
  onRetryLocation(): void;
  onRetrySearch(): void;
  onRecentKeyword(event: WechatMiniprogram.BaseEvent): void;
  onSearchConfirm(): void;
  onSelectPoi(event: WechatMiniprogram.BaseEvent): Promise<void>;
  onUseLocation(): void;
  saveRecentKeyword(keyword: string): void;
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
let latestSearchSequence = 0;

function getSearchHistoryKey(userId: string): string {
  return `foodtrace:user:${userId}:poi-search:recent-keywords`;
}

Page<SearchPageData, SearchPageCustomOption>({
  data: {
    city: '',
    errorMessage: '',
    latitude: null,
    locationMessage: '需要时再获取位置，也可以直接按城市搜索。',
    locationStatus: 'idle',
    longitude: null,
    query: '',
    recentKeywords: [],
    results: [],
    scopeMode: 'location',
    status: 'idle',
    validationMessage: '',
    loadingRows: [1, 2, 3],
  },

  onLoad(): void {
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    if (app.globalData.currentUserId !== null) {
      const cachedValue: unknown = wx.getStorageSync(
        getSearchHistoryKey(app.globalData.currentUserId),
      );
      this.setData({ recentKeywords: normalizeRecentKeywords(cachedValue) });
    }
  },

  onUnload(): void {
    if (searchTimer !== undefined) {
      clearTimeout(searchTimer);
    }
    latestSearchSequence += 1;
  },

  loadLocation(): void {
    this.setData({
      latitude: null,
      locationMessage: '正在获取当前位置…',
      locationStatus: 'loading',
      longitude: null,
    });

    void wx.getLocation({
      fail: (error) => {
        const denied = isLocationPermissionDenied(error.errMsg);
        this.setData({
          locationMessage: denied
            ? '位置权限未开启，也可以按城市继续搜索。'
            : '暂时无法获取位置，可以重试或按城市搜索。',
          locationStatus: denied ? 'denied' : 'error',
          scopeMode: 'city',
        });
      },
      success: (location) => {
        this.setData({
          latitude: location.latitude,
          locationMessage: '位置已就绪，将优先搜索附近店铺',
          locationStatus: 'ready',
          longitude: location.longitude,
        });
        if (validateSearchKeyword(this.data.query).valid) {
          void this.executeSearch();
        }
      },
      type: 'gcj02',
    });
  },

  onInput(event: TextInputEvent): void {
    const query = event.detail.value;
    const validation = validateSearchKeyword(query);
    if (searchTimer !== undefined) {
      clearTimeout(searchTimer);
    }

    this.setData({
      errorMessage: '',
      query,
      results: validation.normalizedKeyword.length === 0 ? [] : this.data.results,
      status: validation.normalizedKeyword.length === 0 ? 'idle' : this.data.status,
      validationMessage: validation.message,
    });

    if (!validation.valid || !this.hasValidScope()) {
      return;
    }

    searchTimer = setTimeout(() => {
      void this.executeSearch();
    }, 350);
  },

  onSearchConfirm(): void {
    if (searchTimer !== undefined) {
      clearTimeout(searchTimer);
    }
    void this.executeSearch();
  },

  async executeSearch(): Promise<void> {
    const validation = validateSearchKeyword(this.data.query);
    if (!validation.valid) {
      this.setData({ validationMessage: validation.message });
      return;
    }
    const cityValidation = validateCity(this.data.city);
    const usesLocation = this.data.scopeMode === 'location';
    const hasLocation =
      this.data.locationStatus === 'ready' &&
      this.data.latitude !== null &&
      this.data.longitude !== null;
    if ((usesLocation && !hasLocation) || (!usesLocation && !cityValidation.valid)) {
      this.setData({
        validationMessage: usesLocation
          ? '请先获取当前位置，或改为按城市搜索'
          : cityValidation.message,
      });
      return;
    }

    const sequence = ++latestSearchSequence;
    this.setData({
      errorMessage: '',
      results: [],
      status: 'loading',
      validationMessage: '',
    });

    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    const client = createApiClient(app.globalData.apiBaseUrl);
    const poiService = new PoiService(client);

    try {
      const items = await poiService.search({
        city: usesLocation ? undefined : cityValidation.normalizedCity,
        keyword: validation.normalizedKeyword,
        latitude: usesLocation ? (this.data.latitude ?? undefined) : undefined,
        longitude: usesLocation ? (this.data.longitude ?? undefined) : undefined,
      });
      if (sequence !== latestSearchSequence) {
        return;
      }
      const results = toPoiSearchViews(items);
      this.saveRecentKeyword(validation.normalizedKeyword);
      this.setData({
        results,
        status: results.length === 0 ? 'empty' : 'results',
      });
    } catch (error: unknown) {
      if (sequence !== latestSearchSequence) {
        return;
      }
      this.setData({
        errorMessage: getSearchErrorMessage(error),
        results: [],
        status: 'error',
      });
    }
  },

  onClear(): void {
    latestSearchSequence += 1;
    if (searchTimer !== undefined) {
      clearTimeout(searchTimer);
    }
    this.setData({
      errorMessage: '',
      query: '',
      results: [],
      status: 'idle',
      validationMessage: '',
    });
  },

  onOpenSettings(): void {
    void wx.openSetting({
      fail: () => {
        this.setData({
          locationMessage: '无法打开设置，请在微信设置中允许使用位置。',
          locationStatus: 'error',
        });
      },
      success: (settings) => {
        if (settings.authSetting['scope.userLocation'] === true) {
          this.loadLocation();
          return;
        }
        this.setData({
          locationMessage: '位置权限仍未开启，你可以稍后再试。',
          locationStatus: 'denied',
        });
      },
    });
  },

  onRetryLocation(): void {
    this.loadLocation();
  },

  onRetrySearch(): void {
    void this.executeSearch();
  },

  onRecentKeyword(event: WechatMiniprogram.BaseEvent): void {
    const dataset = event.currentTarget.dataset as { keyword?: unknown };
    if (typeof dataset.keyword !== 'string') {
      return;
    }
    this.setData({ query: dataset.keyword, validationMessage: '' });
    if (this.hasValidScope()) {
      void this.executeSearch();
    }
  },

  async onSelectPoi(event: WechatMiniprogram.BaseEvent): Promise<void> {
    const dataset = event.currentTarget.dataset as {
      existingRecordId?: unknown;
      mapPoiId?: unknown;
    };
    if (typeof dataset.existingRecordId === 'string' && dataset.existingRecordId.length > 0) {
      void wx.navigateTo({
        url: `/pages/record-detail/index?id=${encodeURIComponent(dataset.existingRecordId)}`,
      });
      return;
    }
    if (typeof dataset.mapPoiId !== 'string' || dataset.mapPoiId.length === 0) {
      void wx.showToast({ icon: 'none', title: '店铺信息不完整，请重新搜索' });
      return;
    }

    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    wx.showLoading({ mask: true, title: '正在加入店铺' });
    try {
      const store = await new StoreService(createApiClient(app.globalData.apiBaseUrl)).createFromTencent(
        dataset.mapPoiId,
      );
      void wx.navigateTo({
        url: `/pages/check-in-editor/index?storeId=${encodeURIComponent(store.id)}`,
      });
    } catch {
      void wx.showToast({ icon: 'none', title: '加入店铺失败，请稍后重试' });
    } finally {
      wx.hideLoading();
    }
  },

  onManualAdd(): void {
    void wx.navigateTo({ url: '/pages/check-in-editor/index?mode=manual' });
  },

  onCityInput(event: TextInputEvent): void {
    const city = event.detail.value;
    const validation = validateCity(city);
    this.setData({
      city,
      scopeMode: 'city',
      validationMessage: city.trim().length === 0 ? '' : validation.message,
    });
  },

  onUseLocation(): void {
    this.setData({ scopeMode: 'location', validationMessage: '' });
    if (this.data.locationStatus !== 'ready') {
      this.loadLocation();
    }
  },

  hasValidScope(): boolean {
    if (this.data.scopeMode === 'city') {
      return validateCity(this.data.city).valid;
    }
    return (
      this.data.locationStatus === 'ready' &&
      this.data.latitude !== null &&
      this.data.longitude !== null
    );
  },

  saveRecentKeyword(keyword: string): void {
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    const userId = app.globalData.currentUserId;
    if (userId === null) {
      return;
    }

    const recentKeywords = prependRecentKeyword(this.data.recentKeywords, keyword);
    this.setData({ recentKeywords });
    try {
      wx.setStorageSync(getSearchHistoryKey(userId), recentKeywords);
    } catch {
      // 缓存失败不影响本次真实搜索结果。
    }
  },
});
