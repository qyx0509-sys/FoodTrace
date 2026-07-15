import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import type { CreateManualStoreDto, CreateTencentStoreDto } from './dto/store.dto';
import { TencentMapClient } from './tencent-map.client';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tencentMap: TencentMapClient,
  ) {}

  async createManual(userId: string, dto: CreateManualStoreDto) {
    const duplicate = await this.prisma.store.findFirst({
      where: {
        deletedAt: null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        name: dto.name.trim(),
        userId,
      },
    });
    if (duplicate !== null) {
      throw new ConflictException({ code: 'STORE_DUPLICATE', message: '这家店已经在你的店铺中' });
    }
    return this.prisma.store.create({
      data: {
        address: dto.address?.trim(),
        category: dto.category?.trim(),
        city: dto.city?.trim(),
        district: dto.district?.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        name: dto.name.trim(),
        source: 'MANUAL',
        userId,
      },
    });
  }

  async createTencent(userId: string, dto: CreateTencentStoreDto) {
    const poi = await this.tencentMap.getDetail(dto.providerPoiId);
    return this.prisma.store.upsert({
      create: {
        address: poi.address,
        category: poi.category,
        city: poi.city,
        district: poi.district,
        latitude: poi.latitude,
        longitude: poi.longitude,
        mapPoiId: poi.providerPoiId,
        name: poi.name,
        phone: poi.phone,
        province: poi.province,
        source: 'TENCENT_POI',
        userId,
      },
      update: { deletedAt: null },
      where: { userId_mapPoiId: { mapPoiId: poi.providerPoiId, userId } },
    });
  }

  async getOne(userId: string, id: string) {
    const store = await this.prisma.store.findFirst({
      include: {
        foodRecord: {
          select: { id: true, status: true },
          where: { deletedAt: null },
        },
      },
      where: { deletedAt: null, id, userId },
    });
    if (store === null) {
      throw new NotFoundException({ code: 'STORE_NOT_FOUND', message: '店铺不存在' });
    }
    return store;
  }
}
