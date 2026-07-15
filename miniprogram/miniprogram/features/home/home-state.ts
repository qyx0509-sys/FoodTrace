export type FoodRecordStatus = 'WANT_TO_GO' | 'VISITED' | 'BLACKLISTED';

export type HomeLoadStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface CachedHomeRecord {
  businessArea?: string;
  category?: string;
  district?: string;
  id: string;
  imagePath?: string;
  overallRating?: number;
  perCapitaPrice?: number;
  recommendedDishes?: string[];
  status: FoodRecordStatus;
  storeName: string;
  tags?: string[];
  totalPrice?: number;
  updatedAt: string;
  visitedAt?: string;
}

export interface HomeRecordView {
  hasImage: boolean;
  hasRating: boolean;
  id: string;
  imagePath: string;
  ratingLabel: string;
  regionLabel: string;
  status: FoodRecordStatus;
  statusLabel: string;
  storeName: string;
  tags: string[];
  updatedLabel: string;
}

export interface HomeStatusSummary {
  count: number;
  label: string;
  status: FoodRecordStatus;
  symbol: string;
}

export interface HomeLoadState {
  errorMessage: string;
  greetingDescription: string;
  greetingTitle: string;
  listEntries: HomeStatusSummary[];
  recentRecords: HomeRecordView[];
  status: HomeLoadStatus;
}

const statusLabels: Record<FoodRecordStatus, string> = {
  BLACKLISTED: '黑名单',
  VISITED: '已打卡',
  WANT_TO_GO: '想去',
};

const statusSummaryDefinitions: Array<Omit<HomeStatusSummary, 'count'>> = [
  { label: '想去', status: 'WANT_TO_GO', symbol: '♡' },
  { label: '已打卡', status: 'VISITED', symbol: '✓' },
  { label: '黑名单', status: 'BLACKLISTED', symbol: '×' },
];

const homeCachePrefix = 'foodtrace:user';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFoodRecordStatus(value: unknown): value is FoodRecordStatus {
  return value === 'WANT_TO_GO' || value === 'VISITED' || value === 'BLACKLISTED';
}

function readOptionalString(item: Record<string, unknown>, key: string): string | undefined {
  const value = item[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readOptionalNumber(
  item: Record<string, unknown>,
  key: string,
  maximum?: number,
): number | undefined {
  const value = item[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  if (maximum !== undefined && value > maximum) {
    return undefined;
  }
  return value;
}

function readStringList(item: Record<string, unknown>, key: string): string[] | undefined {
  const value = item[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry, index, entries) => entry.length > 0 && entries.indexOf(entry) === index)
    .slice(0, 8);
  return result.length > 0 ? result : undefined;
}

function createStatusSummaries(records: CachedHomeRecord[]): HomeStatusSummary[] {
  return statusSummaryDefinitions.map((entry) => ({
    ...entry,
    count: records.filter((record) => record.status === entry.status).length,
  }));
}

export function getHomeCacheKey(userId: string): string {
  return `${homeCachePrefix}:${userId}:home:recent-records`;
}

export function normalizeCachedHomeRecords(value: unknown): CachedHomeRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const records: CachedHomeRecord[] = [];
  for (const item of value as unknown[]) {
    if (!isRecord(item)) {
      continue;
    }
    const id = item['id'];
    const status = item['status'];
    const storeName = item['storeName'];
    const updatedAt = item['updatedAt'];
    if (
      typeof id !== 'string' ||
      !isFoodRecordStatus(status) ||
      typeof storeName !== 'string' ||
      storeName.trim().length === 0 ||
      typeof updatedAt !== 'string'
    ) {
      continue;
    }

    const record: CachedHomeRecord = {
      id,
      status,
      storeName: storeName.trim(),
      updatedAt,
    };
    const optionalStrings = [
      'businessArea',
      'category',
      'district',
      'imagePath',
      'visitedAt',
    ] as const;
    for (const key of optionalStrings) {
      const normalizedValue = readOptionalString(item, key);
      if (normalizedValue !== undefined) {
        record[key] = normalizedValue;
      }
    }
    const overallRating = readOptionalNumber(item, 'overallRating', 5);
    if (overallRating !== undefined) {
      record.overallRating = overallRating;
    }
    const perCapitaPrice = readOptionalNumber(item, 'perCapitaPrice');
    if (perCapitaPrice !== undefined) {
      record.perCapitaPrice = perCapitaPrice;
    }
    const totalPrice = readOptionalNumber(item, 'totalPrice');
    if (totalPrice !== undefined) {
      record.totalPrice = totalPrice;
    }
    const tags = readStringList(item, 'tags');
    if (tags !== undefined) {
      record.tags = tags;
    }
    const recommendedDishes = readStringList(item, 'recommendedDishes');
    if (recommendedDishes !== undefined) {
      record.recommendedDishes = recommendedDishes;
    }
    records.push(record);
  }
  return records;
}

export function createGreetingTitle(now: Date): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 11) {
    return '早上好，今天想吃什么？';
  }
  if (hour >= 11 && hour < 14) {
    return '中午好，今天想吃什么？';
  }
  if (hour >= 14 && hour < 18) {
    return '下午好，今天想吃什么？';
  }
  if (hour >= 18 && hour < 23) {
    return '晚上好，今天想吃什么？';
  }
  return '夜深了，也要好好吃饭';
}

export function formatUpdatedLabel(updatedAt: string, now: Date): string {
  const updatedDate = new Date(updatedAt);
  if (Number.isNaN(updatedDate.getTime())) {
    return '最近更新';
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfUpdatedDay = new Date(
    updatedDate.getFullYear(),
    updatedDate.getMonth(),
    updatedDate.getDate(),
  ).getTime();
  const elapsedDays = Math.floor((startOfToday - startOfUpdatedDay) / 86_400_000);

  if (elapsedDays <= 0) {
    return '今天更新';
  }
  if (elapsedDays < 7) {
    return `${elapsedDays}天前更新`;
  }
  return `${updatedDate.getMonth() + 1}月${updatedDate.getDate()}日更新`;
}

function toHomeRecordView(record: CachedHomeRecord, now: Date): HomeRecordView {
  const regionLabel = record.businessArea ?? record.district ?? record.category ?? '';
  const hasRating = record.overallRating !== undefined;
  return {
    hasImage: record.imagePath !== undefined,
    hasRating,
    id: record.id,
    imagePath: record.imagePath ?? '',
    ratingLabel: hasRating ? (record.overallRating?.toFixed(1) ?? '') : '',
    regionLabel,
    status: record.status,
    statusLabel: statusLabels[record.status],
    storeName: record.storeName,
    tags: record.tags?.slice(0, 2) ?? [],
    updatedLabel: formatUpdatedLabel(record.updatedAt, now),
  };
}

export function createHomeInitialState(now: Date): HomeLoadState {
  return {
    errorMessage: '',
    greetingDescription: '慢慢吃，好好记，把喜欢的味道留在今天。',
    greetingTitle: createGreetingTitle(now),
    listEntries: createStatusSummaries([]),
    recentRecords: [],
    status: 'loading',
  };
}

export function createHomeLoadState(records: CachedHomeRecord[], now: Date): HomeLoadState {
  const recentRecords = [...records]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 3)
    .map((record) => toHomeRecordView(record, now));

  return {
    errorMessage: '',
    greetingDescription: '慢慢吃，好好记，把喜欢的味道留在今天。',
    greetingTitle: createGreetingTitle(now),
    listEntries: createStatusSummaries(records),
    recentRecords,
    status: recentRecords.length === 0 ? 'empty' : 'ready',
  };
}

export function createHomeErrorState(now: Date): HomeLoadState {
  return {
    ...createHomeInitialState(now),
    errorMessage: '暂时没能加载你的足迹，请稍后再试。',
    status: 'error',
  };
}
