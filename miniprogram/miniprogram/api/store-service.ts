import type { HttpClient } from './http-client';

export interface StoreDetail {
  address: string | null;
  category: string | null;
  city: string | null;
  district: string | null;
  foodRecord: { id: string; status: 'WANT_TO_GO' | 'VISITED' | 'BLACKLISTED' } | null;
  id: string;
  latitude: string;
  longitude: string;
  name: string;
  source: 'TENCENT_POI' | 'MANUAL';
}

export interface ManualStoreInput {
  address?: string;
  category?: string;
  city?: string;
  district?: string;
  latitude: number;
  longitude: number;
  name: string;
}

export class StoreService {
  constructor(private readonly client: Pick<HttpClient, 'request'>) {}

  createFromTencent(providerPoiId: string): Promise<StoreDetail> {
    return this.client.request({
      body: { providerPoiId },
      method: 'POST',
      path: '/stores/tencent',
    });
  }

  createManual(input: ManualStoreInput): Promise<StoreDetail> {
    return this.client.request({ body: input, method: 'POST', path: '/stores/manual' });
  }

  getOne(id: string): Promise<StoreDetail> {
    return this.client.request({ path: `/stores/${encodeURIComponent(id)}` });
  }
}
