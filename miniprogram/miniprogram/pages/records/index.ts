import { createApiClient } from '../../api/api-client';
import { RecordService, type FoodRecordDetail, type RecordStatus } from '../../api/record-service';
import type { FoodTraceGlobalData } from '../../app';

interface RecordsData {
  errorMessage: string;
  hasMore: boolean;
  items: RecordListView[];
  loading: boolean;
  loadingMore: boolean;
  page: number;
  query: string;
  status: '' | RecordStatus;
}

interface RecordListView extends FoodRecordDetail { displayDate: string; }

interface RecordsOptions { status?: string; }
interface InputEvent extends WechatMiniprogram.BaseEvent { detail: { value: string }; }
interface RecordsCustomOptions {
  load(reset: boolean): Promise<void>;
  onCreate(): void;
  onInput(event: InputEvent): void;
  onLoadMore(): void;
  onOpen(event: WechatMiniprogram.BaseEvent): void;
  onRetry(): void;
  onSearch(): void;
  onStatus(event: WechatMiniprogram.BaseEvent): void;
}

function isStatus(value: unknown): value is RecordStatus {
  return value === 'WANT_TO_GO' || value === 'VISITED' || value === 'BLACKLISTED';
}

Page<RecordsData, RecordsCustomOptions>({
  data: { errorMessage: '', hasMore: false, items: [], loading: true, loadingMore: false, page: 1, query: '', status: '' },
  onLoad(options: RecordsOptions): void {
    if (isStatus(options.status)) this.setData({ status: options.status });
    void this.load(true);
  },
  onPullDownRefresh(): void { void this.load(true); },
  onReachBottom(): void { this.onLoadMore(); },

  async load(reset: boolean): Promise<void> {
    if (this.data.loadingMore || (!reset && !this.data.hasMore)) return;
    this.setData(reset ? { errorMessage: '', loading: true } : { loadingMore: true });
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    try {
      const page = reset ? 1 : this.data.page + 1;
      const result = await new RecordService(createApiClient(app.globalData.apiBaseUrl)).list({
        page,
        pageSize: 20,
        query: this.data.query.trim() || undefined,
        status: this.data.status || undefined,
      });
      const items = result.items.map((item) => ({ ...item, displayDate: item.updatedAt.slice(0, 10) }));
      this.setData({
        errorMessage: '', hasMore: result.hasMore, items: reset ? items : [...this.data.items, ...items],
        loading: false, loadingMore: false, page,
      });
    } catch {
      this.setData({ errorMessage: '记录加载失败，请检查网络后重试', loading: false, loadingMore: false });
    } finally {
      wx.stopPullDownRefresh();
    }
  },
  onInput(event: InputEvent): void { this.setData({ query: event.detail.value }); },
  onSearch(): void { void this.load(true); },
  onRetry(): void { void this.load(true); },
  onLoadMore(): void { void this.load(false); },
  onStatus(event: WechatMiniprogram.BaseEvent): void {
    const status = event.currentTarget.dataset.status;
    this.setData({ status: isStatus(status) ? status : '' });
    void this.load(true);
  },
  onOpen(event: WechatMiniprogram.BaseEvent): void {
    const id = event.currentTarget.dataset.id;
    if (typeof id === 'string') void wx.navigateTo({ url: `/pages/record-detail/index?id=${encodeURIComponent(id)}` });
  },
  onCreate(): void { void wx.navigateTo({ url: '/pages/store-search/index?mode=checkin' }); },
});
