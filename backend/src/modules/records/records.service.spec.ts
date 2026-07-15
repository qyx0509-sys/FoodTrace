import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../database/prisma.service';
import { RecordsService } from './records.service';

describe('RecordsService ownership isolation', () => {
  it('always includes the authenticated user in a record lookup', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { foodRecord: { findFirst } } as unknown as PrismaService;
    const service = new RecordsService(prisma);

    await expect(service.getOne('user-a', 'record-from-user-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, id: 'record-from-user-b', userId: 'user-a' },
      }),
    );
  });

  it('scopes deletion by JWT user and active state', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma = { foodRecord: { updateMany } } as unknown as PrismaService;
    const service = new RecordsService(prisma);

    await expect(service.softDelete('user-a', 'record-from-user-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, id: 'record-from-user-b', userId: 'user-a' },
      }),
    );
  });
});
