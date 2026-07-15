import type { FoodRecordDetail } from '../../api/record-service';
import type { CachedHomeRecord } from './home-state';

export function toCachedHomeRecord(record: FoodRecordDetail): CachedHomeRecord {
  return {
    businessArea: record.store.district ?? record.store.city ?? undefined,
    category: record.store.category ?? undefined,
    district: record.store.district ?? undefined,
    id: record.id,
    overallRating: record.overallRating === null ? undefined : Number(record.overallRating),
    perCapitaPrice: record.perCapitaPrice === null ? undefined : Number(record.perCapitaPrice),
    recommendedDishes: record.dishes
      .filter((dish) => dish.type === 'RECOMMENDED')
      .map((dish) => dish.name),
    status: record.status,
    storeName: record.store.name,
    tags: record.tags.map((tag) => tag.name),
    totalPrice: record.totalPrice === null ? undefined : Number(record.totalPrice),
    updatedAt: record.updatedAt,
    visitedAt: record.visitedAt ?? undefined,
  };
}
