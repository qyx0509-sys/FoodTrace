import { describe, expect, it } from 'vitest';

import {
  createGreetingTitle,
  createHomeErrorState,
  createHomeLoadState,
  formatUpdatedLabel,
  getHomeCacheKey,
  normalizeCachedHomeRecords,
} from '../miniprogram/features/home/home-state';

describe('home state', () => {
  const now = new Date('2026-07-15T08:00:00.000+08:00');

  it('keeps cache data isolated by user id', () => {
    expect(getHomeCacheKey('user-a')).toBe('foodtrace:user:user-a:home:recent-records');
    expect(getHomeCacheKey('user-b')).not.toBe(getHomeCacheKey('user-a'));
  });

  it('returns real zero counts without inventing records', () => {
    const state = createHomeLoadState([], now);

    expect(state).toMatchObject({
      errorMessage: '',
      recentRecords: [],
      status: 'empty',
    });
    expect(state.listEntries.map((entry) => entry.count)).toEqual([0, 0, 0]);
  });

  it('normalizes real display fields and limits recent entries to three', () => {
    const records = Array.from({ length: 4 }, (_, index) => ({
      businessArea: index === 0 ? '大学城' : undefined,
      id: `record-${index}`,
      imagePath: index === 0 ? 'wxfile://meal.jpg' : undefined,
      overallRating: index === 0 ? 4.8 : undefined,
      status: index === 0 ? ('VISITED' as const) : ('WANT_TO_GO' as const),
      storeName: `店铺 ${index}`,
      tags: index === 0 ? ['川菜', '很下饭'] : undefined,
      updatedAt:
        index === 0 ? '2026-07-15T09:00:00.000+08:00' : `2026-07-15T0${index}:00:00.000+08:00`,
    }));
    const state = createHomeLoadState(normalizeCachedHomeRecords(records), now);

    expect(state.status).toBe('ready');
    expect(state.recentRecords).toHaveLength(3);
    expect(state.listEntries.map((entry) => entry.count)).toEqual([3, 1, 0]);
    expect(state.recentRecords.find((record) => record.id === 'record-0')).toMatchObject({
      hasImage: true,
      ratingLabel: '4.8',
      regionLabel: '大学城',
      statusLabel: '已打卡',
      tags: ['川菜', '很下饭'],
    });
  });

  it('drops invalid optional values instead of displaying fake fallbacks', () => {
    const records = normalizeCachedHomeRecords([
      {
        id: 'record-1',
        overallRating: 8,
        perCapitaPrice: -1,
        status: 'VISITED',
        storeName: '真实店铺',
        tags: ['', '甜品', '甜品'],
        updatedAt: '2026-07-15T00:00:00.000+08:00',
      },
    ]);

    expect(records[0]).toMatchObject({ tags: ['甜品'] });
    expect(records[0]?.overallRating).toBeUndefined();
    expect(records[0]?.perCapitaPrice).toBeUndefined();
  });

  it('uses time-of-day greetings', () => {
    expect(createGreetingTitle(new Date('2026-07-15T12:00:00+08:00'))).toContain('中午好');
    expect(createGreetingTitle(new Date('2026-07-15T20:00:00+08:00'))).toContain('晚上好');
  });

  it('formats update dates deterministically', () => {
    expect(formatUpdatedLabel('2026-07-15T00:00:00.000+08:00', now)).toBe('今天更新');
    expect(formatUpdatedLabel('2026-07-12T00:00:00.000+08:00', now)).toBe('3天前更新');
    expect(formatUpdatedLabel('2026-06-01T00:00:00.000+08:00', now)).toBe('6月1日更新');
    expect(formatUpdatedLabel('invalid', now)).toBe('最近更新');
  });

  it('provides a stable loading failure message and current greeting', () => {
    expect(createHomeErrorState(now)).toMatchObject({
      errorMessage: '暂时没能加载你的足迹，请稍后再试。',
      greetingTitle: '早上好，今天想吃什么？',
      status: 'error',
    });
  });
});
