import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';

import {
  CoordinateType,
  DishType,
  PrismaClient,
  RecordStatus,
  StoreSource,
} from '../src/generated/prisma/client';

loadEnvironment({ path: resolve(process.cwd(), '../.env'), quiet: true });

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the development database.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const seedIds = {
  user: '00000000-0000-4000-8000-000000000001',
  visitedStore: '00000000-0000-4000-8000-000000000101',
  wantedStore: '00000000-0000-4000-8000-000000000102',
  blockedStore: '00000000-0000-4000-8000-000000000103',
  visitedRecord: '00000000-0000-4000-8000-000000000201',
  wantedRecord: '00000000-0000-4000-8000-000000000202',
  blockedRecord: '00000000-0000-4000-8000-000000000203',
  tastyTag: '00000000-0000-4000-8000-000000000301',
  revisitTag: '00000000-0000-4000-8000-000000000302',
  image: '00000000-0000-4000-8000-000000000401',
  recommendedDish: '00000000-0000-4000-8000-000000000501',
  avoidedDish: '00000000-0000-4000-8000-000000000502',
} as const;

async function seed(): Promise<void> {
  await prisma.user.upsert({
    where: { id: seedIds.user },
    update: {
      locale: 'zh-CN',
      nickname: '食迹体验用户',
      status: 'ACTIVE',
      timezone: 'Asia/Shanghai',
    },
    create: {
      id: seedIds.user,
      locale: 'zh-CN',
      nickname: '食迹体验用户',
      timezone: 'Asia/Shanghai',
    },
  });

  await prisma.store.upsert({
    where: {
      userId_mapPoiId: {
        mapPoiId: 'dev-tencent-poi-001',
        userId: seedIds.user,
      },
    },
    update: {
      address: '上海市黄浦区示例路 1 号',
      category: '本帮菜',
      city: '上海市',
      district: '黄浦区',
      latitude: '31.2304160',
      longitude: '121.4737010',
      name: '食迹示例本帮菜',
    },
    create: {
      id: seedIds.visitedStore,
      address: '上海市黄浦区示例路 1 号',
      category: '本帮菜',
      city: '上海市',
      coordinateType: CoordinateType.GCJ02,
      district: '黄浦区',
      latitude: '31.2304160',
      longitude: '121.4737010',
      mapPoiId: 'dev-tencent-poi-001',
      name: '食迹示例本帮菜',
      source: StoreSource.TENCENT_POI,
      userId: seedIds.user,
    },
  });

  await prisma.store.upsert({
    where: { id: seedIds.wantedStore },
    update: {
      address: '上海市徐汇区示例路 2 号',
      name: '食迹手动添加咖啡店',
    },
    create: {
      id: seedIds.wantedStore,
      address: '上海市徐汇区示例路 2 号',
      category: '咖啡',
      city: '上海市',
      coordinateType: CoordinateType.GCJ02,
      district: '徐汇区',
      latitude: '31.1885230',
      longitude: '121.4365250',
      name: '食迹手动添加咖啡店',
      source: StoreSource.MANUAL,
      userId: seedIds.user,
    },
  });

  await prisma.store.upsert({
    where: {
      userId_mapPoiId: {
        mapPoiId: 'dev-tencent-poi-002',
        userId: seedIds.user,
      },
    },
    update: {
      address: '上海市静安区示例路 3 号',
      name: '食迹示例踩雷店',
    },
    create: {
      id: seedIds.blockedStore,
      address: '上海市静安区示例路 3 号',
      category: '小吃',
      city: '上海市',
      coordinateType: CoordinateType.GCJ02,
      district: '静安区',
      latitude: '31.2290030',
      longitude: '121.4467080',
      mapPoiId: 'dev-tencent-poi-002',
      name: '食迹示例踩雷店',
      source: StoreSource.TENCENT_POI,
      userId: seedIds.user,
    },
  });

  await prisma.foodRecord.upsert({
    where: {
      userId_storeId: {
        storeId: seedIds.visitedStore,
        userId: seedIds.user,
      },
    },
    update: {
      environmentRating: '4.0',
      notes: '开发种子数据：适合验证列表、详情、标签和图片关联。',
      overallRating: '4.5',
      perCapitaPrice: '128.00',
      serviceRating: '4.0',
      status: RecordStatus.VISITED,
      tasteRating: '4.5',
      visitedAt: new Date('2026-01-15T00:00:00.000Z'),
    },
    create: {
      id: seedIds.visitedRecord,
      environmentRating: '4.0',
      notes: '开发种子数据：适合验证列表、详情、标签和图片关联。',
      overallRating: '4.5',
      perCapitaPrice: '128.00',
      serviceRating: '4.0',
      status: RecordStatus.VISITED,
      storeId: seedIds.visitedStore,
      tasteRating: '4.5',
      userId: seedIds.user,
      visitedAt: new Date('2026-01-15T00:00:00.000Z'),
    },
  });

  await prisma.foodRecord.upsert({
    where: {
      userId_storeId: {
        storeId: seedIds.wantedStore,
        userId: seedIds.user,
      },
    },
    update: {
      notes: '开发种子数据：周末想去。',
      status: RecordStatus.WANT_TO_GO,
    },
    create: {
      id: seedIds.wantedRecord,
      notes: '开发种子数据：周末想去。',
      status: RecordStatus.WANT_TO_GO,
      storeId: seedIds.wantedStore,
      userId: seedIds.user,
    },
  });

  await prisma.foodRecord.upsert({
    where: {
      userId_storeId: {
        storeId: seedIds.blockedStore,
        userId: seedIds.user,
      },
    },
    update: {
      notes: '开发种子数据：不再考虑。',
      status: RecordStatus.BLACKLISTED,
    },
    create: {
      id: seedIds.blockedRecord,
      notes: '开发种子数据：不再考虑。',
      status: RecordStatus.BLACKLISTED,
      storeId: seedIds.blockedStore,
      userId: seedIds.user,
    },
  });

  await prisma.tag.upsert({
    where: {
      userId_normalizedName: {
        normalizedName: '好吃',
        userId: seedIds.user,
      },
    },
    update: { color: '#F97316', name: '好吃' },
    create: {
      id: seedIds.tastyTag,
      color: '#F97316',
      name: '好吃',
      normalizedName: '好吃',
      userId: seedIds.user,
    },
  });

  await prisma.tag.upsert({
    where: {
      userId_normalizedName: {
        normalizedName: '会再去',
        userId: seedIds.user,
      },
    },
    update: { color: '#16A34A', name: '会再去' },
    create: {
      id: seedIds.revisitTag,
      color: '#16A34A',
      name: '会再去',
      normalizedName: '会再去',
      userId: seedIds.user,
    },
  });

  for (const tagId of [seedIds.tastyTag, seedIds.revisitTag]) {
    await prisma.recordTag.upsert({
      where: {
        recordId_tagId: {
          recordId: seedIds.visitedRecord,
          tagId,
        },
      },
      update: {},
      create: {
        recordId: seedIds.visitedRecord,
        tagId,
        userId: seedIds.user,
      },
    });
  }

  await prisma.recordImage.upsert({
    where: {
      objectKey: `private/dev-seed/users/${seedIds.user}/records/${seedIds.visitedRecord}/${seedIds.image}.jpg`,
    },
    update: {
      height: 900,
      mimeType: 'image/jpeg',
      sizeBytes: 245_760n,
      sortOrder: 0,
      width: 1200,
    },
    create: {
      id: seedIds.image,
      height: 900,
      mimeType: 'image/jpeg',
      objectKey: `private/dev-seed/users/${seedIds.user}/records/${seedIds.visitedRecord}/${seedIds.image}.jpg`,
      recordId: seedIds.visitedRecord,
      sizeBytes: 245_760n,
      sortOrder: 0,
      userId: seedIds.user,
      width: 1200,
    },
  });

  await prisma.dishRecord.upsert({
    where: {
      userId_recordId_type_normalizedName: {
        normalizedName: '红烧肉',
        recordId: seedIds.visitedRecord,
        type: DishType.RECOMMENDED,
        userId: seedIds.user,
      },
    },
    update: { name: '红烧肉', sortOrder: 0 },
    create: {
      id: seedIds.recommendedDish,
      name: '红烧肉',
      normalizedName: '红烧肉',
      recordId: seedIds.visitedRecord,
      sortOrder: 0,
      type: DishType.RECOMMENDED,
      userId: seedIds.user,
    },
  });

  await prisma.dishRecord.upsert({
    where: {
      userId_recordId_type_normalizedName: {
        normalizedName: '炸物拼盘',
        recordId: seedIds.blockedRecord,
        type: DishType.AVOIDED,
        userId: seedIds.user,
      },
    },
    update: { name: '炸物拼盘', sortOrder: 0 },
    create: {
      id: seedIds.avoidedDish,
      name: '炸物拼盘',
      normalizedName: '炸物拼盘',
      recordId: seedIds.blockedRecord,
      sortOrder: 0,
      type: DishType.AVOIDED,
      userId: seedIds.user,
    },
  });

  console.info('Development seed completed: 1 user, 3 stores, 3 food records.');
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
