import {
  getHomeCacheKey,
  normalizeCachedHomeRecords,
  type CachedHomeRecord,
} from '../features/home/home-state';

export interface DailyJournalRecord {
  category: string;
  id: string;
  imagePath: string;
  overallRating: number | null;
  perCapitaPrice: number | null;
  recommendedDishes: string[];
  regionLabel: string;
  storeName: string;
  tags: string[];
  updatedAt: string;
}

export interface DailyJournal {
  averagePerCapita: number | null;
  dateKey: string;
  dateLabel: string;
  overflowCount: number;
  records: DailyJournalRecord[];
  summary: string;
  totalCount: number;
  totalSpent: number | null;
  weekdayLabel: string;
}

export interface JournalStorage {
  get(key: string): Promise<unknown>;
}

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function createWxJournalStorage(): JournalStorage {
  return {
    get(key: string): Promise<unknown> {
      return new Promise((resolve, reject) => {
        wx.getStorage({
          fail: (error) => {
            if (error.errMsg.includes('not found')) {
              resolve([]);
              return;
            }
            reject(new Error(error.errMsg));
          },
          key,
          success: (result) => {
            resolve(result.data);
          },
        });
      });
    },
  };
}

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRecordDateKey(visitedAt: string | undefined): string | null {
  if (visitedAt === undefined) {
    return null;
  }
  const plainDate = /^(\d{4}-\d{2}-\d{2})/.exec(visitedAt)?.[1];
  if (plainDate !== undefined) {
    return plainDate;
  }
  const parsed = new Date(visitedAt);
  return Number.isNaN(parsed.getTime()) ? null : formatLocalDateKey(parsed);
}

function compareRecordTime(left: CachedHomeRecord, right: CachedHomeRecord): number {
  const leftTime = Date.parse(left.updatedAt);
  const rightTime = Date.parse(right.updatedAt);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return left.storeName.localeCompare(right.storeName, 'zh-CN');
  }
  return leftTime - rightTime;
}

function toJournalRecord(record: CachedHomeRecord): DailyJournalRecord {
  return {
    category: record.category ?? '',
    id: record.id,
    imagePath: record.imagePath ?? '',
    overallRating: record.overallRating ?? null,
    perCapitaPrice: record.perCapitaPrice ?? null,
    recommendedDishes: record.recommendedDishes ?? [],
    regionLabel: record.businessArea ?? record.district ?? '',
    storeName: record.storeName,
    tags: record.tags ?? [],
    updatedAt: record.updatedAt,
  };
}

function getAveragePerCapita(records: DailyJournalRecord[]): number | null {
  const prices = records
    .map((record) => record.perCapitaPrice)
    .filter((price): price is number => price !== null);
  if (prices.length === 0) {
    return null;
  }
  return Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length);
}

function getFavoriteStore(records: DailyJournalRecord[]): string | null {
  const ratedRecords = records.filter(
    (record): record is DailyJournalRecord & { overallRating: number } =>
      record.overallRating !== null,
  );
  ratedRecords.sort((left, right) => right.overallRating - left.overallRating);
  return ratedRecords[0]?.storeName ?? null;
}

function getTopCategories(records: DailyJournalRecord[]): string[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    const category = record.category
      .split(':')
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1);
    if (category !== undefined) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
    .slice(0, 2)
    .map(([category]) => category);
}

export function createJournalSummary(
  records: DailyJournalRecord[],
  averagePerCapita: number | null,
): string {
  if (records.length === 0) {
    return '';
  }
  const favoriteStore = getFavoriteStore(records);
  if (records.length > 1 && favoriteStore !== null) {
    return `今天解锁了 ${records.length} 家店，最喜欢的是${favoriteStore}。`;
  }
  const categories = getTopCategories(records);
  if (categories.length >= 2 && averagePerCapita !== null) {
    return `今日偏爱${categories[0]}和${categories[1]}，人均约 ${averagePerCapita} 元。`;
  }
  const dishes = records.flatMap((record) => record.recommendedDishes).slice(0, 2);
  if (dishes.length >= 2) {
    return `今天是一场从${dishes[0]}到${dishes[1]}的快乐路线。`;
  }
  return `今天的美味主角是${records[0]?.storeName ?? '这一餐'}。`;
}

export function createDailyJournal(records: CachedHomeRecord[], now: Date): DailyJournal {
  const dateKey = formatLocalDateKey(now);
  const allVisitedRecords = records
    .filter(
      (record) => record.status === 'VISITED' && getRecordDateKey(record.visitedAt) === dateKey,
    )
    .sort(compareRecordTime)
    .map(toJournalRecord);
  const averagePerCapita = getAveragePerCapita(allVisitedRecords);
  const visibleRecords = allVisitedRecords.slice(0, 4);

  return {
    averagePerCapita,
    dateKey,
    dateLabel: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
    overflowCount: Math.max(0, allVisitedRecords.length - visibleRecords.length),
    records: visibleRecords,
    summary: createJournalSummary(allVisitedRecords, averagePerCapita),
    totalCount: allVisitedRecords.length,
    totalSpent: null,
    weekdayLabel: weekdays[now.getDay()] ?? '',
  };
}

export async function loadDailyJournal(
  userId: string | null,
  now: Date,
  storage: JournalStorage = createWxJournalStorage(),
): Promise<DailyJournal> {
  if (userId === null) {
    return createDailyJournal([], now);
  }
  const cachedValue = await storage.get(getHomeCacheKey(userId));
  return createDailyJournal(normalizeCachedHomeRecords(cachedValue), now);
}
