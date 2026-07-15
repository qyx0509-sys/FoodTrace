import { describe, expect, it, vi } from 'vitest';

import type { CachedHomeRecord } from '../miniprogram/features/home/home-state';
import {
  createDailyJournal,
  createJournalSummary,
  loadDailyJournal,
} from '../miniprogram/services/journal-service';

function createRecord(id: string, overrides: Partial<CachedHomeRecord> = {}): CachedHomeRecord {
  return {
    id,
    status: 'VISITED',
    storeName: `店铺 ${id}`,
    updatedAt: `2026-07-15T${id.padStart(2, '0')}:00:00+08:00`,
    visitedAt: '2026-07-15',
    ...overrides,
  };
}

describe('daily journal service', () => {
  const now = new Date('2026-07-15T18:00:00+08:00');

  it('uses only today VISITED records and sorts by actual update time', () => {
    const journal = createDailyJournal(
      [
        createRecord('03'),
        createRecord('01'),
        createRecord('02', { status: 'WANT_TO_GO' }),
        createRecord('04', { visitedAt: '2026-07-14' }),
        createRecord('05', { status: 'BLACKLISTED' }),
      ],
      now,
    );

    expect(journal.totalCount).toBe(2);
    expect(journal.records.map((record) => record.id)).toEqual(['01', '03']);
  });

  it('shows at most four stores and reports the real overflow count', () => {
    const journal = createDailyJournal(
      Array.from({ length: 6 }, (_, index) => createRecord(String(index + 1))),
      now,
    );

    expect(journal.records).toHaveLength(4);
    expect(journal.totalCount).toBe(6);
    expect(journal.overflowCount).toBe(2);
  });

  it('only calculates average per-capita from provided values', () => {
    const journal = createDailyJournal(
      [createRecord('01', { perCapitaPrice: 40 }), createRecord('02', { perCapitaPrice: 80 })],
      now,
    );

    expect(journal.averagePerCapita).toBe(60);
    expect(journal.totalSpent).toBeNull();
  });

  it('creates summaries from real ratings, categories, or dishes', () => {
    const ratedRecords = createDailyJournal(
      [
        createRecord('01', { overallRating: 4.2, storeName: '小馆' }),
        createRecord('02', { overallRating: 4.9, storeName: '面包房' }),
      ],
      now,
    ).records;
    const categoryRecords = createDailyJournal(
      [createRecord('01', { category: '川菜' }), createRecord('02', { category: '甜品' })],
      now,
    ).records;

    expect(createJournalSummary(ratedRecords, null)).toContain('最喜欢的是面包房');
    expect(createJournalSummary(categoryRecords, 58)).toBe('今日偏爱川菜和甜品，人均约 58 元。');
  });

  it('does not generate content for an empty day', () => {
    const journal = createDailyJournal([], now);

    expect(journal.records).toEqual([]);
    expect(journal.summary).toBe('');
    expect(journal.totalCount).toBe(0);
  });

  it('reads only the current user cache key', async () => {
    const get = vi.fn().mockResolvedValue([createRecord('01')]);

    await loadDailyJournal('user-a', now, { get });

    expect(get).toHaveBeenCalledWith('foodtrace:user:user-a:home:recent-records');
  });
});
