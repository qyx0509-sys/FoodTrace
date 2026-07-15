import { createApiClient } from '../../api/api-client';
import { UserService, type CurrentUserProfile } from '../../api/user-service';
import type { FoodTraceGlobalData } from '../../app';
import { authSession } from '../../services/auth-session';

interface ProfileData { errorMessage: string; loading: boolean; user: CurrentUserProfile | null; }
interface ProfileCustomOptions { load(): Promise<void>; onLogout(): void; onOpenRecords(): void; onRetry(): void; }

Page<ProfileData, ProfileCustomOptions>({
  data: { errorMessage: '', loading: true, user: null },
  onLoad(): void { void this.load(); },
  async load(): Promise<void> {
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    try {
      const user = await new UserService(createApiClient(app.globalData.apiBaseUrl)).getMe();
      this.setData({ errorMessage: '', loading: false, user });
    } catch {
      this.setData({ errorMessage: '个人信息加载失败', loading: false });
    }
  },
  onRetry(): void { this.setData({ loading: true }); void this.load(); },
  onOpenRecords(): void { void wx.navigateTo({ url: '/pages/records/index' }); },
  onLogout(): void {
    void wx.showModal({
      cancelText: '取消', confirmColor: '#F05A47', confirmText: '退出', content: '本地登录状态会被清除，需要重新登录才能查看私人记录。', title: '退出登录？',
      success: async (result) => {
        if (!result.confirm) return;
        const app = getApp<{ globalData: FoodTraceGlobalData }>();
        try { await new UserService(createApiClient(app.globalData.apiBaseUrl)).logout(); } catch { /* 本地会话仍需清除。 */ }
        authSession.clear();
        app.globalData.currentUserId = null;
        void wx.reLaunch({ url: '/pages/login/index' });
      },
    });
  },
});
