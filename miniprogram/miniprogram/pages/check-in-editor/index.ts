import { createApiClient } from '../../api/api-client';
import { RecordService, type FoodRecordDetail, type RecordStatus } from '../../api/record-service';
import { StoreService, type StoreDetail } from '../../api/store-service';
import type { FoodTraceGlobalData } from '../../app';

interface InputEvent extends WechatMiniprogram.BaseEvent {
  detail: { value: string };
}

interface EditorData {
  address: string;
  avoidedDishesText: string;
  clientRequestId: string;
  companions: string;
  dirty: boolean;
  environmentRating: string;
  errorMessage: string;
  latitude: string;
  loading: boolean;
  longitude: string;
  notes: string;
  overallRating: string;
  perCapitaPrice: string;
  recommendedDishesText: string;
  recordId: string;
  saving: boolean;
  status: RecordStatus;
  storeId: string;
  storeName: string;
  summary: string;
  tagsText: string;
  serviceRating: string;
  tasteRating: string;
  totalPrice: string;
  valueRating: string;
  version: number;
  visitedAt: string;
}

interface EditorOptions {
  id?: string;
  mode?: string;
  storeId?: string;
}

interface EditorCustomOptions {
  applyStore(store: StoreDetail): void;
  loadRecord(recordId: string): Promise<void>;
  loadStore(storeId: string): Promise<void>;
  markDirty(): void;
  onAddressInput(event: InputEvent): void;
  onAvoidedDishesInput(event: InputEvent): void;
  onCompanionsInput(event: InputEvent): void;
  onDateChange(event: InputEvent): void;
  onLatitudeInput(event: InputEvent): void;
  onLongitudeInput(event: InputEvent): void;
  onNotesInput(event: InputEvent): void;
  onEnvironmentRatingInput(event: InputEvent): void;
  onPriceInput(event: InputEvent): void;
  onRatingInput(event: InputEvent): void;
  onRecommendedDishesInput(event: InputEvent): void;
  onSave(event: WechatMiniprogram.BaseEvent): Promise<void>;
  onStatusChange(event: WechatMiniprogram.BaseEvent): void;
  onStoreNameInput(event: InputEvent): void;
  onSummaryInput(event: InputEvent): void;
  onTagsInput(event: InputEvent): void;
  onServiceRatingInput(event: InputEvent): void;
  onTasteRatingInput(event: InputEvent): void;
  onTotalPriceInput(event: InputEvent): void;
  onUseLocation(): void;
  onValueRatingInput(event: InputEvent): void;
  validate(): string;
}

function createUuid(): string {
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function valueOf(event: InputEvent): string {
  return event.detail.value;
}

Page<EditorData, EditorCustomOptions>({
  data: {
    address: '',
    avoidedDishesText: '',
    clientRequestId: createUuid(),
    companions: '',
    dirty: false,
    errorMessage: '',
    environmentRating: '',
    latitude: '',
    loading: true,
    longitude: '',
    notes: '',
    overallRating: '',
    perCapitaPrice: '',
    recommendedDishesText: '',
    recordId: '',
    saving: false,
    status: 'VISITED',
    storeId: '',
    storeName: '',
    summary: '',
    tagsText: '',
    serviceRating: '',
    tasteRating: '',
    totalPrice: '',
    valueRating: '',
    version: 1,
    visitedAt: today(),
  },

  onLoad(options: EditorOptions): void {
    if (typeof options.id === 'string' && options.id.length > 0) {
      this.setData({ recordId: options.id });
      void this.loadRecord(options.id);
      return;
    }
    if (typeof options.storeId === 'string' && options.storeId.length > 0) {
      this.setData({ storeId: options.storeId });
      void this.loadStore(options.storeId);
      return;
    }
    this.setData({ loading: false });
  },

  onUnload(): void {
    wx.disableAlertBeforeUnload();
  },

  async loadStore(storeId: string): Promise<void> {
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    try {
      const store = await new StoreService(createApiClient(app.globalData.apiBaseUrl)).getOne(
        storeId,
      );
      this.applyStore(store);
    } catch {
      this.setData({ errorMessage: '店铺信息加载失败，请返回重试', loading: false });
    }
  },

  async loadRecord(recordId: string): Promise<void> {
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    try {
      const record = await new RecordService(createApiClient(app.globalData.apiBaseUrl)).getOne(
        recordId,
      );
      this.setData({
        address: record.store.address ?? '',
        avoidedDishesText: record.dishes
          .filter((dish) => dish.type === 'AVOIDED')
          .map((dish) => dish.name)
          .join('、'),
        companions: record.companions ?? '',
        environmentRating: record.environmentRating ?? '',
        latitude: record.store.latitude,
        loading: false,
        longitude: record.store.longitude,
        notes: record.notes ?? '',
        overallRating: record.overallRating ?? '',
        perCapitaPrice: record.perCapitaPrice ?? '',
        recommendedDishesText: record.dishes
          .filter((dish) => dish.type === 'RECOMMENDED')
          .map((dish) => dish.name)
          .join('、'),
        serviceRating: record.serviceRating ?? '',
        status: record.status,
        storeId: record.store.id,
        storeName: record.store.name,
        summary: record.summary ?? '',
        tagsText: record.tags.map((tag) => tag.name).join('、'),
        tasteRating: record.tasteRating ?? '',
        totalPrice: record.totalPrice ?? '',
        valueRating: record.valueRating ?? '',
        version: record.version,
        visitedAt: record.visitedAt?.slice(0, 10) ?? today(),
      });
    } catch {
      this.setData({ errorMessage: '记录加载失败，请返回重试', loading: false });
    }
  },

  applyStore(store: StoreDetail): void {
    this.setData({
      address: store.address ?? '',
      latitude: store.latitude,
      loading: false,
      longitude: store.longitude,
      storeName: store.name,
    });
  },

  markDirty(): void {
    if (!this.data.dirty) {
      this.setData({ dirty: true });
      wx.enableAlertBeforeUnload({ message: '这餐还没保存，确定要离开吗？' });
    }
  },

  onStoreNameInput(event: InputEvent): void {
    this.setData({ storeName: valueOf(event) });
    this.markDirty();
  },
  onAddressInput(event: InputEvent): void {
    this.setData({ address: valueOf(event) });
    this.markDirty();
  },
  onLatitudeInput(event: InputEvent): void {
    this.setData({ latitude: valueOf(event) });
    this.markDirty();
  },
  onLongitudeInput(event: InputEvent): void {
    this.setData({ longitude: valueOf(event) });
    this.markDirty();
  },
  onRatingInput(event: InputEvent): void {
    this.setData({ overallRating: valueOf(event) });
    this.markDirty();
  },
  onPriceInput(event: InputEvent): void {
    this.setData({ perCapitaPrice: valueOf(event) });
    this.markDirty();
  },
  onSummaryInput(event: InputEvent): void {
    this.setData({ summary: valueOf(event) });
    this.markDirty();
  },
  onNotesInput(event: InputEvent): void {
    this.setData({ notes: valueOf(event) });
    this.markDirty();
  },
  onTagsInput(event: InputEvent): void {
    this.setData({ tagsText: valueOf(event) });
    this.markDirty();
  },
  onTasteRatingInput(event: InputEvent): void {
    this.setData({ tasteRating: valueOf(event) });
    this.markDirty();
  },
  onEnvironmentRatingInput(event: InputEvent): void {
    this.setData({ environmentRating: valueOf(event) });
    this.markDirty();
  },
  onServiceRatingInput(event: InputEvent): void {
    this.setData({ serviceRating: valueOf(event) });
    this.markDirty();
  },
  onValueRatingInput(event: InputEvent): void {
    this.setData({ valueRating: valueOf(event) });
    this.markDirty();
  },
  onTotalPriceInput(event: InputEvent): void {
    this.setData({ totalPrice: valueOf(event) });
    this.markDirty();
  },
  onCompanionsInput(event: InputEvent): void {
    this.setData({ companions: valueOf(event) });
    this.markDirty();
  },
  onRecommendedDishesInput(event: InputEvent): void {
    this.setData({ recommendedDishesText: valueOf(event) });
    this.markDirty();
  },
  onAvoidedDishesInput(event: InputEvent): void {
    this.setData({ avoidedDishesText: valueOf(event) });
    this.markDirty();
  },
  onDateChange(event: InputEvent): void {
    this.setData({ visitedAt: valueOf(event) });
    this.markDirty();
  },
  onStatusChange(event: WechatMiniprogram.BaseEvent): void {
    const { status } = event.currentTarget.dataset as { status?: unknown };
    if (status === 'WANT_TO_GO' || status === 'VISITED' || status === 'BLACKLISTED') {
      this.setData({ status });
      this.markDirty();
    }
  },

  onUseLocation(): void {
    void wx.showLoading({ title: '正在定位' });
    void wx.getLocation({
      fail: () => wx.showToast({ icon: 'none', title: '未能取得位置，可手动填写经纬度' }),
      success: (location) => {
        this.setData({
          latitude: String(location.latitude),
          longitude: String(location.longitude),
        });
        this.markDirty();
      },
      complete: () => wx.hideLoading(),
      type: 'gcj02',
    });
  },

  async onSave(event: WechatMiniprogram.BaseEvent): Promise<void> {
    const dataset = event.currentTarget.dataset as { draft?: unknown };
    const draft = dataset.draft === true;
    if (this.data.saving) return;
    const validationMessage = this.validate();
    if (validationMessage !== '') {
      this.setData({ errorMessage: validationMessage });
      return;
    }
    this.setData({ errorMessage: '', saving: true });
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    const client = createApiClient(app.globalData.apiBaseUrl);
    try {
      let storeId = this.data.storeId;
      if (storeId === '') {
        const store = await new StoreService(client).createManual({
          address: this.data.address.trim(),
          latitude: Number(this.data.latitude),
          longitude: Number(this.data.longitude),
          name: this.data.storeName.trim(),
        });
        storeId = store.id;
      }
      const tags = this.data.tagsText
        .split(/[、,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      const toDishes = (
        text: string,
        type: 'RECOMMENDED' | 'AVOIDED',
      ): Array<{ name: string; type: 'RECOMMENDED' | 'AVOIDED' }> =>
        text
          .split(/[、,，]/)
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ name, type }));
      const input = {
        companions: this.data.companions.trim() || undefined,
        dishes: [
          ...toDishes(this.data.recommendedDishesText, 'RECOMMENDED'),
          ...toDishes(this.data.avoidedDishesText, 'AVOIDED'),
        ],
        environmentRating:
          this.data.environmentRating === '' ? undefined : Number(this.data.environmentRating),
        isDraft: draft,
        notes: this.data.notes.trim() || undefined,
        overallRating: this.data.overallRating === '' ? undefined : Number(this.data.overallRating),
        perCapitaPrice: this.data.perCapitaPrice.trim() || undefined,
        serviceRating: this.data.serviceRating === '' ? undefined : Number(this.data.serviceRating),
        status: this.data.status,
        summary: this.data.summary.trim() || undefined,
        tags,
        tasteRating: this.data.tasteRating === '' ? undefined : Number(this.data.tasteRating),
        totalPrice: this.data.totalPrice.trim() || undefined,
        valueRating: this.data.valueRating === '' ? undefined : Number(this.data.valueRating),
        visitedAt: this.data.status === 'VISITED' ? this.data.visitedAt : undefined,
      };
      const service = new RecordService(client);
      const record: FoodRecordDetail =
        this.data.recordId === ''
          ? await service.create({ ...input, clientRequestId: this.data.clientRequestId, storeId })
          : await service.update(this.data.recordId, { ...input, version: this.data.version });
      wx.disableAlertBeforeUnload();
      this.setData({ dirty: false, recordId: record.id, version: record.version });
      void wx.showToast({ icon: 'success', title: draft ? '草稿已保存' : '记录已保存' });
      setTimeout(() => {
        void wx.redirectTo({
          url: `/pages/record-detail/index?id=${encodeURIComponent(record.id)}`,
        });
      }, 500);
    } catch {
      this.setData({ errorMessage: '保存失败，请检查网络后重试' });
    } finally {
      this.setData({ saving: false });
    }
  },

  validate(): string {
    if (this.data.storeName.trim().length === 0) return '请填写店铺名称';
    const latitude = Number(this.data.latitude);
    const longitude = Number(this.data.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return '请填写有效纬度';
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return '请填写有效经度';
    const ratings: Array<[string, string]> = [
      ['综合', this.data.overallRating],
      ['口味', this.data.tasteRating],
      ['环境', this.data.environmentRating],
      ['服务', this.data.serviceRating],
      ['性价比', this.data.valueRating],
    ];
    for (const [label, value] of ratings) {
      if (value === '') continue;
      const rating = Number(value);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5 || !Number.isInteger(rating * 2)) {
        return `${label}评分需为 1 到 5，支持 0.5 分`;
      }
    }
    if (
      this.data.perCapitaPrice !== '' &&
      !/^\d{1,8}(?:\.\d{1,2})?$/.test(this.data.perCapitaPrice)
    ) {
      return '人均消费最多保留两位小数';
    }
    if (this.data.totalPrice !== '' && !/^\d{1,8}(?:\.\d{1,2})?$/.test(this.data.totalPrice)) {
      return '总消费最多保留两位小数';
    }
    return '';
  },
});
