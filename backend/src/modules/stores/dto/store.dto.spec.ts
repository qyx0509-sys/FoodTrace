import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateManualStoreDto } from './store.dto';

describe('CreateManualStoreDto', () => {
  it('rejects coordinates outside the GCJ-02 numeric range', async () => {
    const dto = plainToInstance(CreateManualStoreDto, {
      latitude: 91,
      longitude: -181,
      name: '边界测试店铺',
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['latitude', 'longitude']),
    );
  });
});
