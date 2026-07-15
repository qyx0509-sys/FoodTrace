import { createApiClient } from '../../api/api-client';
import { RecordService, type FoodRecordDetail } from '../../api/record-service';
import type { FoodTraceGlobalData } from '../../app';

interface DetailView extends FoodRecordDetail {
  dateLabel: string;
  ratingLabel: string;
  statusLabel: string;
}
interface DetailData { errorMessage: string; loading: boolean; record: DetailView | null; }
interface DetailOptions { id?: string; }
interface DetailCustomOptions {
  load(): Promise<void>;
  onDelete(): void;
  onEdit(): void;
  onOpenStore(): void;
  onRetry(): void;
  onToggleFavorite(): Promise<void>;
}

function toView(record: FoodRecordDetail): DetailView {
  const statusLabels = { BLACKLISTED: '黑名单', VISITED: '已打卡', WANT_TO_GO: '想去' } as const;
  return {
    ...record,
    dateLabel: (record.mealAt ?? record.visitedAt ?? record.updatedAt).slice(0, 10),
    ratingLabel: record.overallRating === null ? '未评分' : `${record.overallRating} 分`,
    statusLabel: statusLabels[record.status],
  };
}

Page<DetailData, DetailCustomOptions>({
  data: { errorMessage: '', loading: true, record: null },
  onLoad(options: DetailOptions): void {
    if (typeof options.id !== 'string' || options.id.length === 0) {
      this.setData({ errorMessage: '记录参数不完整', loading: false });
      return;
    }
    this.setData({ record: { id: options.id } as DetailView });
    void this.load();
  },
  onShow(): void { if (this.data.record !== null && !this.data.loading) void this.load(); },
  async load(): Promise<void> {
    const id = this.data.record?.id;
    if (id === undefined) return;
    this.setData({ errorMessage: '', loading: true });
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    try {
      const record = await new RecordService(createApiClient(app.globalData.apiBaseUrl)).getOne(id);
      this.setData({ loading: false, record: toView(record) });
    } catch {
      this.setData({ errorMessage: '这条记录暂时无法打开', loading: false, record: null });
    }
  },
  onRetry(): void { void this.load(); },
  onEdit(): void {
    if (this.data.record !== null) void wx.navigateTo({ url: `/pages/check-in-editor/index?id=${encodeURIComponent(this.data.record.id)}` });
  },
  onOpenStore(): void {
    if (this.data.record !== null) void wx.navigateTo({ url: `/pages/store-detail/index?id=${encodeURIComponent(this.data.record.store.id)}` });
  },
  async onToggleFavorite(): Promise<void> {
    const record = this.data.record;
    if (record === null) return;
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    try {
      const updated = await new RecordService(createApiClient(app.globalData.apiBaseUrl)).update(record.id, {
        isFavorite: !record.isFavorite,
        version: record.version,
      });
      this.setData({ record: toView(updated) });
      wx.showToast({ icon: 'success', title: updated.isFavorite ? '已收藏' : '已取消收藏' });
    } catch {
      wx.showToast({ icon: 'none', title: '操作失败，请稍后重试' });
    }
  },
  onDelete(): void {
    const record = this.data.record;
    if (record === null) return;
    void wx.showModal({
      cancelText: '取消', confirmColor: '#F05A47', confirmText: '删除', content: '删除后将不再出现在记录列表中。', title: '删除这条记录？',
      success: async (result) => {
        if (!result.confirm) return;
        const app = getApp<{ globalData: FoodTraceGlobalData }>();
        try {
          await new RecordService(createApiClient(app.globalData.apiBaseUrl)).remove(record.id);
          wx.showToast({ icon: 'success', title: '已删除' });
          setTimeout(() => void wx.navigateBack(), 400);
        } catch {
          wx.showToast({ icon: 'none', title: '删除失败，请稍后重试' });
        }
      },
    });
  },
});
