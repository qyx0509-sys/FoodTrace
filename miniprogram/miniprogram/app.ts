import { runtimeConfig } from './config/runtime-config';
import { authSession } from './services/auth-session';

export interface FoodTraceGlobalData {
  apiBaseUrl: string;
  currentUserId: string | null;
}

App<{ globalData: FoodTraceGlobalData }>({
  globalData: {
    apiBaseUrl: runtimeConfig.apiBaseUrl,
    currentUserId: null,
  },
  onLaunch(): void {
    this.globalData.currentUserId = authSession.getCurrentUser()?.id ?? null;
  },
});
