import { describe, expect, it } from 'vitest';

import {
  JOURNAL_POSTER_HEIGHT,
  JOURNAL_POSTER_WIDTH,
  getPosterCardLayouts,
} from '../miniprogram/utils/canvas/journal-poster-renderer';

describe('journal poster layout', () => {
  it.each([1, 2, 3, 4])('keeps %i store cards inside the poster without overlap', (count) => {
    const layouts = getPosterCardLayouts(count);

    expect(layouts).toHaveLength(count);
    layouts.forEach((layout, index) => {
      expect(layout.x).toBeGreaterThanOrEqual(0);
      expect(layout.y).toBeGreaterThanOrEqual(0);
      expect(layout.x + layout.width).toBeLessThanOrEqual(JOURNAL_POSTER_WIDTH);
      expect(layout.y + layout.height).toBeLessThan(1184);
      if (index > 0) {
        const previous = layouts[index - 1];
        expect(layout.y).toBeGreaterThan((previous?.y ?? 0) + (previous?.height ?? 0));
      }
    });
    expect(JOURNAL_POSTER_HEIGHT).toBe(1440);
  });

  it('refuses layouts beyond the supported four stores', () => {
    expect(getPosterCardLayouts(8)).toHaveLength(4);
    expect(getPosterCardLayouts(0)).toEqual([]);
  });
});
