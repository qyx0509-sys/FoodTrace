import { createApiClient } from '../../api/api-client';
import { StoreService, type StoreDetail } from '../../api/store-service';
import type { FoodTraceGlobalData } from '../../app';

interface StoreDetailData { errorMessage: string; loading: boolean; store: StoreDetail | null; storeId: string; }
interface Options { id?: string; }
interface CustomOptions { load(): Promise<void>; onCheckIn(): void; onOpenRecord(): void; onRetry(): void; }

Page<StoreDetailData, CustomOptions>({
  data: { errorMessage: '', loading: true, store: null, storeId: '' },
  onLoad(options: Options): void {
    if (typeof options.id !== 'string' || options.id.length === 0) {
      this.setData({ errorMessage: '店铺参数不完整', loading: false });
      return;
    }
    this.setData({ storeId: options.id });
    void this.load();
  },
  onShow(): void { if (this.data.storeId !== '' && !this.data.loading) void this.load(); },
  async load(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    try {
      const store = await new StoreService(createApiClient(app.globalData.apiBaseUrl)).getOne(this.data.storeId);
      this.setData({ loading: false, store });
    } catch {
      this.setData({ errorMessage: '店铺信息加载失败', loading: false, store: null });
    }
  },
  onRetry(): void { void this.load(); },
  onCheckIn(): void { void wx.navigateTo({ url: `/pages/check-in-editor/index?storeId=${encodeURIComponent(this.data.storeId)}` }); },
  onOpenRecord(): void {
    const id = this.data.store?.foodRecord?.id;
    if (id !== undefined) void wx.navigateTo({ url: `/pages/record-detail/index?id=${encodeURIComponent(id)}` });
  },
});
