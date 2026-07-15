import { runtimeConfig } from './config/runtime-config';

export interface FoodTraceGlobalData {
  apiBaseUrl: string;
  currentUserId: string | null;
}

App<{ globalData: FoodTraceGlobalData }>({
  globalData: {
    apiBaseUrl: runtimeConfig.apiBaseUrl,
    currentUserId: null,
  },
});
