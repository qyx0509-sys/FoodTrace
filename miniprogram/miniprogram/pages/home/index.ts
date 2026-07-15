import type { FoodTraceGlobalData } from '../../app';
import {
  createHomeErrorState,
  createHomeInitialState,
  createHomeLoadState,
  getHomeCacheKey,
  normalizeCachedHomeRecords,
  type CachedHomeRecord,
  type HomeLoadState,
} from '../../features/home/home-state';
import { loadDailyJournal } from '../../services/journal-service';
import { createApiClient } from '../../api/api-client';
import { RecordService } from '../../api/record-service';
import { authSession } from '../../services/auth-session';
import { toCachedHomeRecord } from '../../features/home/record-mapper';

interface ComponentActionEvent<T> extends WechatMiniprogram.BaseEvent {
  detail: T;
}

interface HomePageCustomOption {
  loadHome(): Promise<void>;
  onGenerateJournal(): Promise<void>;
  onManualAdd(): void;
  onOpenList(event: ComponentActionEvent<{ label?: string; status?: string }>): void;
  onOpenRecord(event: ComponentActionEvent<{ id?: string }>): void;
  onOpenProfile(): void;
  onRetry(): void;
  onSearchStore(): void;
  onStartCheckIn(): void;
}

function readRecentRecords(userId: string | null): Promise<CachedHomeRecord[]> {
  if (userId === null) {
    return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
    wx.getStorage({
      fail: (error) => {
        if (error.errMsg.includes('not found')) {
          resolve([]);
          return;
        }
        reject(new Error(error.errMsg));
      },
      key: getHomeCacheKey(userId),
      success: (result) => {
        resolve(normalizeCachedHomeRecords(result.data));
      },
    });
  });
}

const initialState = createHomeInitialState(new Date());

Page<HomeLoadState, HomePageCustomOption>({
  data: initialState,

  onLoad(): void {
    if (authSession.getAccessToken() === null) {
      void wx.reLaunch({ url: '/pages/login/index' });
      return;
    }
    void this.loadHome();
  },

  onShow(): void {
    if (this.data.status !== 'loading') {
      void this.loadHome();
    }
  },

  onPullDownRefresh(): void {
    void this.loadHome();
  },

  async loadHome(): Promise<void> {
    const now = new Date();
    this.setData({ ...createHomeInitialState(now), status: 'loading' });
    const app = getApp<{ globalData: FoodTraceGlobalData }>();

    try {
      const userId = app.globalData.currentUserId;
      if (userId === null) {
        void wx.reLaunch({ url: '/pages/login/index' });
        return;
      }
      let records: CachedHomeRecord[];
      try {
        const client = createApiClient(app.globalData.apiBaseUrl);
        const collection = await new RecordService(client).list({ pageSize: 50 });
        records = collection.items.map(toCachedHomeRecord);
        wx.setStorageSync(getHomeCacheKey(userId), records);
      } catch {
        records = await readRecentRecords(userId);
        if (records.length === 0) {
          throw new Error('HOME_DATA_UNAVAILABLE');
        }
      }
      this.setData(createHomeLoadState(records, now));
    } catch {
      this.setData(createHomeErrorState(now));
    } finally {
      void wx.stopPullDownRefresh();
    }
  },

  onRetry(): void {
    void this.loadHome();
  },

  onStartCheckIn(): void {
    void wx.navigateTo({ url: '/pages/store-search/index?mode=checkin' });
  },

  onSearchStore(): void {
    void wx.navigateTo({ url: '/pages/store-search/index?mode=browse' });
  },

  onOpenProfile(): void {
    void wx.navigateTo({ url: '/pages/profile/index' });
  },

  onManualAdd(): void {
    void wx.navigateTo({ url: '/pages/check-in-editor/index?mode=manual' });
  },

  onOpenList(event: ComponentActionEvent<{ label?: string; status?: string }>): void {
    const status = event.detail.status;
    const query = typeof status === 'string' ? `?status=${encodeURIComponent(status)}` : '';
    void wx.navigateTo({ url: `/pages/records/index${query}` });
  },

  onOpenRecord(event: ComponentActionEvent<{ id?: string }>): void {
    if (typeof event.detail.id === 'string') {
      void wx.navigateTo({ url: `/pages/record-detail/index?id=${encodeURIComponent(event.detail.id)}` });
    }
  },

  async onGenerateJournal(): Promise<void> {
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    try {
      const journal = await loadDailyJournal(app.globalData.currentUserId, new Date());
      if (journal.totalCount > 0) {
        void wx.navigateTo({ url: '/pages/daily-journal/index' });
        return;
      }
      void wx.showModal({
        cancelText: '取消',
        confirmColor: '#F05A47',
        confirmText: '去打卡',
        content: '今天还没有美食足迹，先去记录一家吧～',
        success: (result) => {
          if (result.confirm) {
            this.onStartCheckIn();
          }
        },
        title: '今日手账还空着',
      });
    } catch {
      void wx.showToast({ icon: 'none', title: '暂时没能读取今天的足迹' });
    }
  },
});
