import type { FoodTraceGlobalData } from '../../app';
import type { DailyJournal } from '../../services/journal-service';
import { loadDailyJournal } from '../../services/journal-service';

type JournalPageStatus = 'loading' | 'generating' | 'ready' | 'empty' | 'error';

interface JournalPageData {
  errorMessage: string;
  journal: DailyJournal | null;
  posterPath: string;
  saving: boolean;
  sharing: boolean;
  status: JournalPageStatus;
}

interface JournalPosterInstance extends WechatMiniprogram.Component.TrivialInstance {
  generate(journal: DailyJournal): Promise<string>;
}

interface DailyJournalPageOption {
  generatePoster(): Promise<void>;
  loadJournal(): Promise<void>;
  onBackHome(): void;
  onGoCheckIn(): void;
  onRegenerate(): void;
  onRetry(): void;
  onSavePoster(): void;
  onSharePoster(): void;
  openPhotoSettings(): void;
  savePoster(): Promise<void>;
  sharePoster(): Promise<void>;
}

function isAuthorizationDenied(errorMessage: string): boolean {
  return errorMessage.includes('auth deny') || errorMessage.includes('auth denied');
}

Page<JournalPageData, DailyJournalPageOption>({
  data: {
    errorMessage: '',
    journal: null,
    posterPath: '',
    saving: false,
    sharing: false,
    status: 'loading',
  },

  onLoad(): void {
    void this.loadJournal();
  },

  async loadJournal(): Promise<void> {
    this.setData({ errorMessage: '', posterPath: '', status: 'loading' });
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    try {
      const journal = await loadDailyJournal(app.globalData.currentUserId, new Date());
      if (journal.totalCount === 0 || journal.records.length === 0) {
        this.setData({ journal, status: 'empty' });
        return;
      }
      this.setData({ journal, status: 'generating' });
      await new Promise<void>((resolve) => wx.nextTick(resolve));
      await this.generatePoster();
    } catch {
      this.setData({
        errorMessage: '手账生成失败，请检查图片后再试一次。',
        status: 'error',
      });
    }
  },

  async generatePoster(): Promise<void> {
    const journal = this.data.journal;
    if (journal === null || journal.records.length === 0) {
      this.setData({ status: 'empty' });
      return;
    }
    this.setData({ errorMessage: '', posterPath: '', status: 'generating' });
    try {
      const poster = this.selectComponent('#journal-poster') as JournalPosterInstance | null;
      if (poster === null || typeof poster.generate !== 'function') {
        throw new Error('JOURNAL_POSTER_NOT_READY');
      }
      const posterPath = await poster.generate(journal);
      this.setData({ posterPath, status: 'ready' });
    } catch {
      this.setData({
        errorMessage: '图片绘制没有完成，请稍后重新生成。',
        status: 'error',
      });
    }
  },

  onRetry(): void {
    void this.loadJournal();
  },

  onRegenerate(): void {
    void this.generatePoster();
  },

  onGoCheckIn(): void {
    void wx.redirectTo({ url: '/pages/store-search/index?mode=checkin' });
  },

  onBackHome(): void {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      void wx.navigateBack();
      return;
    }
    void wx.reLaunch({ url: '/pages/home/index' });
  },

  onSavePoster(): void {
    void this.savePoster();
  },

  async savePoster(): Promise<void> {
    if (this.data.posterPath.length === 0 || this.data.saving) {
      return;
    }
    this.setData({ saving: true });
    try {
      await wx.saveImageToPhotosAlbum({ filePath: this.data.posterPath });
      void wx.showToast({ icon: 'success', title: '已保存到相册' });
    } catch (error) {
      const message = (error as WechatMiniprogram.GeneralCallbackResult).errMsg ?? '';
      if (isAuthorizationDenied(message)) {
        void wx.showModal({
          cancelText: '暂不开启',
          confirmColor: '#F05A47',
          confirmText: '去设置',
          content: '请在设置中允许“保存到相册”，开启后就能收藏今日手账。',
          success: (result) => {
            if (result.confirm) {
              this.openPhotoSettings();
            }
          },
          title: '需要相册权限',
        });
      } else if (!message.includes('cancel')) {
        void wx.showToast({ icon: 'none', title: '保存失败，请稍后再试' });
      }
    } finally {
      this.setData({ saving: false });
    }
  },

  openPhotoSettings(): void {
    void wx.openSetting({
      success: (result) => {
        if (result.authSetting['scope.writePhotosAlbum'] === true) {
          void this.savePoster();
        }
      },
    });
  },

  onSharePoster(): void {
    void this.sharePoster();
  },

  async sharePoster(): Promise<void> {
    if (this.data.posterPath.length === 0 || this.data.sharing) {
      return;
    }
    if (!wx.canIUse('showShareImageMenu')) {
      void wx.showModal({
        confirmColor: '#F05A47',
        content: '当前微信版本暂不支持直接分享图片，请先保存到相册，再从相册分享给朋友。',
        showCancel: false,
        title: '先保存再分享',
      });
      return;
    }
    this.setData({ sharing: true });
    try {
      await wx.showShareImageMenu({
        entrancePath: '/pages/home/index',
        needShowEntrance: true,
        path: this.data.posterPath,
      });
    } catch (error) {
      const message = (error as WechatMiniprogram.GeneralCallbackResult).errMsg ?? '';
      if (!message.includes('cancel')) {
        void wx.showModal({
          confirmColor: '#F05A47',
          content: '直接分享没有成功，请先保存到相册，再从相册分享给朋友。',
          showCancel: false,
          title: '换一种分享方式',
        });
      }
    } finally {
      this.setData({ sharing: false });
    }
  },
});
