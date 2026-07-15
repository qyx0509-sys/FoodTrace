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

interface ComponentActionEvent<T> extends WechatMiniprogram.BaseEvent {
  detail: T;
}

interface HomePageCustomOption {
  loadHome(): Promise<void>;
  onGenerateJournal(): Promise<void>;
  onManualAdd(): void;
  onOpenList(event: ComponentActionEvent<{ label?: string; status?: string }>): void;
  onOpenRecord(event: ComponentActionEvent<{ id?: string }>): void;
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
      const records = await readRecentRecords(app.globalData.currentUserId);
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

  onManualAdd(): void {
    void wx.showToast({ icon: 'none', title: '手动添加页将在后续开放' });
  },

  onOpenList(event: ComponentActionEvent<{ label?: string; status?: string }>): void {
    void wx.showToast({ icon: 'none', title: `${event.detail.label ?? '该'}清单将在后续开放` });
  },

  onOpenRecord(): void {
    void wx.showToast({ icon: 'none', title: '店铺详情页将在后续开放' });
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
