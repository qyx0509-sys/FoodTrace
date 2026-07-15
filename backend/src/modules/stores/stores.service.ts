import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import type { RecordStatus, Store } from '../../generated/prisma/client';
import type { CreateManualStoreDto, CreateTencentStoreDto } from './dto/store.dto';
import { TencentMapClient } from './tencent-map.client';

interface StoreResponse {
  address: string | null;
  category: string | null;
  city: string | null;
  coordinateType: Store['coordinateType'];
  district: string | null;
  foodRecord: { id: string; status: RecordStatus } | null;
  id: string;
  latitude: string;
  longitude: string;
  mapPoiId: string | null;
  name: string;
  phone: string | null;
  province: string | null;
  source: Store['source'];
}

function serializeStore(
  store: Store,
  foodRecord: StoreResponse['foodRecord'] = null,
): StoreResponse {
  return {
    address: store.address,
    category: store.category,
    city: store.city,
    coordinateType: store.coordinateType,
    district: store.district,
    foodRecord,
    id: store.id,
    latitude: store.latitude.toString(),
    longitude: store.longitude.toString(),
    mapPoiId: store.mapPoiId,
    name: store.name,
    phone: store.phone,
    province: store.province,
    source: store.source,
  };
}

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tencentMap: TencentMapClient,
  ) {}

  async createManual(userId: string, dto: CreateManualStoreDto): Promise<StoreResponse> {
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
    const store = await this.prisma.store.create({
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
    return serializeStore(store);
  }

  async createTencent(userId: string, dto: CreateTencentStoreDto): Promise<StoreResponse> {
    const poi = await this.tencentMap.getDetail(dto.providerPoiId);
    const store = await this.prisma.store.upsert({
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
    return serializeStore(store);
  }

  async getOne(userId: string, id: string): Promise<StoreResponse> {
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
    return serializeStore(store, store.foodRecord);
  }
}
