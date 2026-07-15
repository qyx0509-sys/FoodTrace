export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type RequestBody = WechatMiniprogram.IAnyObject | string | ArrayBuffer;

export interface TokenProvider {
  getAccessToken(): string | null;
  onAuthenticationExpired?(): void;
  refreshAccessToken?(): Promise<string | null>;
}

export interface RequestOptions {
  body?: RequestBody;
  headers?: Record<string, string>;
  method?: HttpMethod;
  path: string;
  timeoutMs?: number;
}

interface ApiSuccessEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }

  const error = value.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

function isSuccessEnvelope<T>(value: unknown): value is ApiSuccessEnvelope<T> {
  return typeof value === 'object' && value !== null && 'data' in value;
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly tokenProvider: TokenProvider,
  ) {}

  request<T>(options: RequestOptions): Promise<T> {
    return this.execute<T>(options, false);
  }

  private execute<T>(options: RequestOptions, retried: boolean): Promise<T> {
    const accessToken = this.tokenProvider.getAccessToken();
    const header: Record<string, string> = {
      'content-type': 'application/json',
      ...options.headers,
    };

    if (accessToken !== null) {
      header.Authorization = `Bearer ${accessToken}`;
    }

    return new Promise<T>((resolve, reject) => {
      wx.request<ApiSuccessEnvelope<T> | ApiErrorEnvelope>({
        data: options.body,
        fail: (error) => {
          reject(new ApiError('NETWORK_ERROR', error.errMsg, 0));
        },
        header,
        method: options.method ?? 'GET',
        success: (response) => {
          if (response.statusCode === 204) {
            resolve(undefined as T);
            return;
          }
          if (
            response.statusCode >= 200 &&
            response.statusCode < 300 &&
            isSuccessEnvelope<T>(response.data)
          ) {
            resolve(response.data.data);
            return;
          }

          if (response.statusCode === 401 && !retried && this.tokenProvider.refreshAccessToken) {
            void this.tokenProvider.refreshAccessToken().then((token) => {
              if (token === null) {
                this.tokenProvider.onAuthenticationExpired?.();
                reject(new ApiError('AUTH_EXPIRED', '登录已失效，请重新登录', 401));
                return;
              }
              this.execute<T>(options, true).then(resolve, reject);
            });
            return;
          }

          if (isErrorEnvelope(response.data)) {
            reject(
              new ApiError(
                response.data.error.code,
                response.data.error.message,
                response.statusCode,
                response.data.error.requestId,
              ),
            );
            return;
          }

          reject(new ApiError('UNEXPECTED_RESPONSE', '服务响应格式不正确', response.statusCode));
        },
        timeout: options.timeoutMs ?? 10_000,
        url: joinUrl(this.baseUrl, options.path),
      });
    });
  }
}
