import type { FoodTraceGlobalData } from '../../app';
import { ApiError } from '../../api/http-client';
import { authSession } from '../../services/auth-session';

interface LoginPageData {
  errorMessage: string;
  loading: boolean;
}

interface LoginPageOption {
  onLogin(): void;
  submitLogin(): Promise<void>;
}

Page<LoginPageData, LoginPageOption>({
  data: { errorMessage: '', loading: false },

  onLoad(): void {
    if (authSession.getAccessToken() !== null && authSession.getCurrentUser() !== null) {
      void wx.reLaunch({ url: '/pages/home/index' });
    }
  },

  onLogin(): void {
    void this.submitLogin();
  },

  async submitLogin(): Promise<void> {
    if (this.data.loading) return;
    this.setData({ errorMessage: '', loading: true });
    const app = getApp<{ globalData: FoodTraceGlobalData }>();
    try {
      const user = await authSession.loginWithWeChat(app.globalData.apiBaseUrl);
      app.globalData.currentUserId = user.id;
      void wx.reLaunch({ url: '/pages/home/index' });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '登录没有完成，请稍后重试';
      this.setData({ errorMessage: message });
    } finally {
      this.setData({ loading: false });
    }
  },
});
