import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateFoodRecordDto } from './record.dto';

const baseInput = {
  clientRequestId: '00000000-0000-4000-8000-000000000010',
  status: 'VISITED',
  storeId: '00000000-0000-4000-8000-000000000020',
};

describe('CreateFoodRecordDto', () => {
  it('rejects invalid ratings and monetary formats', async () => {
    const dto = plainToInstance(CreateFoodRecordDto, {
      ...baseInput,
      overallRating: 5.1,
      totalPrice: '-0.01',
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['overallRating', 'totalPrice']),
    );
  });

  it('rejects a client-forged userId before the controller runs', async () => {
    const pipe = new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    });

    try {
      await pipe.transform(
        { ...baseInput, userId: '00000000-0000-4000-8000-000000000999' },
        { metatype: CreateFoodRecordDto, type: 'body' },
      );
      throw new Error('ValidationPipe accepted a forged userId');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BadRequestException);
      if (!(error instanceof BadRequestException)) throw error;
      expect(JSON.stringify(error.getResponse())).toContain('property userId should not exist');
    }
  });
});
