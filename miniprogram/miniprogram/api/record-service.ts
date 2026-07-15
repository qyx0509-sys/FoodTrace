import type { HttpClient } from './http-client';

export type RecordStatus = 'WANT_TO_GO' | 'VISITED' | 'BLACKLISTED';

export interface RecordStore {
  address: string | null;
  category: string | null;
  city: string | null;
  district: string | null;
  id: string;
  latitude: string;
  longitude: string;
  name: string;
}

export interface FoodRecordDetail {
  clientRequestId: string | null;
  companionCount: number | null;
  companions: string | null;
  createdAt: string;
  dishes: Array<{ id: string; name: string; type: 'RECOMMENDED' | 'AVOIDED' }>;
  environmentRating: string | null;
  id: string;
  images: Array<{ id: string; objectKey: string; sortOrder: number }>;
  isDraft: boolean;
  isFavorite: boolean;
  isRecommended: boolean | null;
  mealAt: string | null;
  notes: string | null;
  overallRating: string | null;
  perCapitaPrice: string | null;
  serviceRating: string | null;
  status: RecordStatus;
  store: RecordStore;
  summary: string | null;
  tags: Array<{ id: string; name: string }>;
  tasteRating: string | null;
  totalPrice: string | null;
  updatedAt: string;
  valueRating: string | null;
  version: number;
  visitedAt: string | null;
  wouldRevisit: boolean | null;
}

export interface RecordCollection {
  hasMore: boolean;
  items: FoodRecordDetail[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RecordInput {
  clientRequestId?: string;
  companionCount?: number;
  companions?: string;
  dishes?: Array<{ name: string; type: 'RECOMMENDED' | 'AVOIDED' }>;
  environmentRating?: number;
  isDraft?: boolean;
  isFavorite?: boolean;
  isRecommended?: boolean;
  mealAt?: string;
  notes?: string;
  overallRating?: number;
  perCapitaPrice?: string;
  serviceRating?: number;
  status?: RecordStatus;
  storeId?: string;
  summary?: string;
  tags?: string[];
  tasteRating?: number;
  totalPrice?: string;
  valueRating?: number;
  version?: number;
  visitedAt?: string;
  wouldRevisit?: boolean;
}

export class RecordService {
  constructor(private readonly client: Pick<HttpClient, 'request'>) {}

  list(parameters: {
    favorite?: boolean;
    page?: number;
    pageSize?: number;
    query?: string;
    status?: RecordStatus;
  } = {}): Promise<RecordCollection> {
    const query: Array<[string, string]> = [
      ['page', String(parameters.page ?? 1)],
      ['pageSize', String(parameters.pageSize ?? 20)],
    ];
    if (parameters.status !== undefined) query.push(['status', parameters.status]);
    if (parameters.query !== undefined) query.push(['query', parameters.query]);
    if (parameters.favorite !== undefined) query.push(['favorite', String(parameters.favorite)]);
    return this.client.request({
      path: `/records?${query
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&')}`,
    });
  }

  getOne(id: string): Promise<FoodRecordDetail> {
    return this.client.request({ path: `/records/${encodeURIComponent(id)}` });
  }

  create(input: RecordInput & { clientRequestId: string; status: RecordStatus; storeId: string }) {
    return this.client.request<FoodRecordDetail>({ body: input, method: 'POST', path: '/records' });
  }

  update(id: string, input: RecordInput & { version: number }) {
    return this.client.request<FoodRecordDetail>({
      body: input,
      method: 'PUT',
      path: `/records/${encodeURIComponent(id)}`,
    });
  }

  remove(id: string): Promise<void> {
    return this.client.request({ method: 'DELETE', path: `/records/${encodeURIComponent(id)}` });
  }
}
