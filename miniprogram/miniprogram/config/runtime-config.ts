export type AppEnvironment = 'development' | 'production';

export interface RuntimeConfig {
  apiBaseUrl: string;
  environment: AppEnvironment;
}

// 该文件只包含非敏感的构建配置。微信、COS、JWT 和数据库永久密钥不得写入小程序。
export const runtimeConfig: Readonly<RuntimeConfig> = Object.freeze({
  apiBaseUrl: 'http://127.0.0.1:3000/api/v1',
  environment: 'development',
});
