import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import type { PoiSearchQueryDto } from './dto/poi-query.dto';
import { TencentMapClient } from './tencent-map.client';

@Injectable()
export class PoiService {
  constructor(
    private readonly map: TencentMapClient,
    private readonly prisma: PrismaService,
  ) {}

  async search(userId: string, query: PoiSearchQueryDto) {
    const result = await this.map.search(query);
    const poiIds = result.items.map((item) => item.providerPoiId);
    const existingStores =
      poiIds.length === 0
        ? []
        : await this.prisma.store.findMany({
            include: {
              foodRecord: {
                select: { id: true, status: true },
                where: { deletedAt: null },
              },
            },
            where: { deletedAt: null, mapPoiId: { in: poiIds }, userId },
          });
    const existingByPoi = new Map(
      existingStores.map((store) => [store.mapPoiId, store.foodRecord] as const),
    );
    return {
      hasMore: query.page * query.limit < result.total,
      items: result.items.map((item) => ({
        ...item,
        coordinateType: 'GCJ02' as const,
        existingRecord: existingByPoi.get(item.providerPoiId) ?? null,
        provider: 'TENCENT' as const,
      })),
      page: query.page,
      pageSize: query.limit,
      total: result.total,
    };
  }
}
