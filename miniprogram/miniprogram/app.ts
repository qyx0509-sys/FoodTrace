import { runtimeConfig } from './config/runtime-config';

export interface FoodTraceGlobalData {
  apiBaseUrl: string;
}

App<{ globalData: FoodTraceGlobalData }>({
  globalData: {
    apiBaseUrl: runtimeConfig.apiBaseUrl,
  },
});
