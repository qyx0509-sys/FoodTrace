import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, type FoodRecord } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateFoodRecordDto, UpdateFoodRecordDto } from './dto/record.dto';
import type { RecordListQueryDto } from './dto/record-query.dto';

const recordInclude = {
  dishes: { orderBy: [{ type: 'asc' as const }, { sortOrder: 'asc' as const }] },
  images: { orderBy: { sortOrder: 'asc' as const } },
  recordTags: { include: { tag: true } },
  store: true,
} satisfies Prisma.FoodRecordInclude;

type RecordWithRelations = Prisma.FoodRecordGetPayload<{ include: typeof recordInclude }>;
type RecordScalarData = Partial<
  Pick<
    Prisma.FoodRecordUncheckedCreateInput,
    | 'companionCount'
    | 'companions'
    | 'environmentRating'
    | 'isDraft'
    | 'isFavorite'
    | 'isRecommended'
    | 'mealAt'
    | 'notes'
    | 'overallRating'
    | 'perCapitaPrice'
    | 'serviceRating'
    | 'status'
    | 'summary'
    | 'tasteRating'
    | 'totalPrice'
    | 'valueRating'
    | 'visitedAt'
    | 'wouldRevisit'
  >
>;

function trimOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function toVisitedDate(value: string | undefined): Date | null {
  return value === undefined ? null : new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function validateRatings(dto: Partial<CreateFoodRecordDto>): void {
  const values = [
    dto.overallRating,
    dto.tasteRating,
    dto.environmentRating,
    dto.serviceRating,
    dto.valueRating,
  ];
  if (values.some((value) => value !== undefined && !Number.isInteger(value * 2))) {
    throw new BadRequestException({ code: 'RATING_STEP_INVALID', message: '评分必须以 0.5 为步长' });
  }
}

function serializeRecord(record: RecordWithRelations) {
  return {
    ...record,
    environmentRating: record.environmentRating?.toString() ?? null,
    images: record.images.map((image) => ({
      ...image,
      sizeBytes: image.sizeBytes.toString(),
    })),
    overallRating: record.overallRating?.toString() ?? null,
    perCapitaPrice: record.perCapitaPrice?.toString() ?? null,
    recordTags: undefined,
    serviceRating: record.serviceRating?.toString() ?? null,
    store: {
      ...record.store,
      latitude: record.store.latitude.toString(),
      longitude: record.store.longitude.toString(),
    },
    tags: record.recordTags.map(({ tag }) => tag),
    tasteRating: record.tasteRating?.toString() ?? null,
    totalPrice: record.totalPrice?.toString() ?? null,
    valueRating: record.valueRating?.toString() ?? null,
  };
}

@Injectable()
export class RecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFoodRecordDto) {
    validateRatings(dto);
    const existingRequest = await this.prisma.foodRecord.findUnique({
      include: recordInclude,
      where: { userId_clientRequestId: { clientRequestId: dto.clientRequestId, userId } },
    });
    if (existingRequest !== null) {
      return serializeRecord(existingRequest);
    }
    const store = await this.prisma.store.findFirst({
      select: { id: true },
      where: { deletedAt: null, id: dto.storeId, userId },
    });
    if (store === null) {
      throw new NotFoundException({ code: 'STORE_NOT_FOUND', message: '店铺不存在' });
    }
    const existingStoreRecord = await this.prisma.foodRecord.findUnique({
      where: { userId_storeId: { storeId: dto.storeId, userId } },
    });
    if (existingStoreRecord !== null && existingStoreRecord.deletedAt === null) {
      throw new ConflictException({ code: 'RECORD_DUPLICATE', message: '这家店已经有一条记录' });
    }

    const record = await this.prisma.$transaction(async (transaction) => {
      const baseData = this.toRecordData(dto);
      const saved =
        existingStoreRecord === null
          ? await transaction.foodRecord.create({
              data: {
                ...baseData,
                clientRequestId: dto.clientRequestId,
                status: dto.status,
                storeId: dto.storeId,
                userId,
              },
            })
          : await transaction.foodRecord.update({
              data: {
                ...baseData,
                clientRequestId: dto.clientRequestId,
                deletedAt: null,
                version: { increment: 1 },
              },
              where: { id: existingStoreRecord.id },
            });
      await this.replaceTagsAndDishes(transaction, userId, saved.id, dto.tags, dto.dishes);
      return transaction.foodRecord.findUniqueOrThrow({ include: recordInclude, where: { id: saved.id } });
    });
    return serializeRecord(record);
  }

  async list(userId: string, query: RecordListQueryDto) {
    const search = query.query?.trim();
    const where: Prisma.FoodRecordWhereInput = {
      deletedAt: null,
      isDraft: false,
      isFavorite: query.favorite,
      status: query.status,
      userId,
      ...(search
        ? {
            OR: [
              { store: { name: { contains: search, mode: 'insensitive' } } },
              { store: { address: { contains: search, mode: 'insensitive' } } },
              { notes: { contains: search, mode: 'insensitive' } },
              { summary: { contains: search, mode: 'insensitive' } },
              { dishes: { some: { name: { contains: search, mode: 'insensitive' } } } },
              { recordTags: { some: { tag: { name: { contains: search, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.foodRecord.findMany({
        include: recordInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
      this.prisma.foodRecord.count({ where }),
    ]);
    return {
      hasMore: query.page * query.pageSize < total,
      items: items.map(serializeRecord),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async getOne(userId: string, id: string) {
    const record = await this.prisma.foodRecord.findFirst({
      include: recordInclude,
      where: { deletedAt: null, id, userId },
    });
    if (record === null) {
      throw new NotFoundException({ code: 'RECORD_NOT_FOUND', message: '记录不存在或已删除' });
    }
    return serializeRecord(record);
  }

  async update(userId: string, id: string, dto: UpdateFoodRecordDto) {
    validateRatings(dto);
    const current = await this.prisma.foodRecord.findFirst({
      include: recordInclude,
      where: { deletedAt: null, id, userId },
    });
    if (current === null) {
      throw new NotFoundException({ code: 'RECORD_NOT_FOUND', message: '记录不存在或已删除' });
    }
    const record = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.foodRecord.updateMany({
        data: { ...this.toRecordData(dto), version: { increment: 1 } },
        where: { deletedAt: null, id, userId, version: dto.version },
      });
      if (updated.count !== 1) {
        return null;
      }
      if (dto.tags !== undefined || dto.dishes !== undefined) {
        await this.replaceTagsAndDishes(
          transaction,
          userId,
          id,
          dto.tags ?? current.recordTags.map(({ tag }) => tag.name),
          dto.dishes ?? current.dishes.map(({ name, type }) => ({ name, type })),
        );
      }
      return transaction.foodRecord.findUniqueOrThrow({ include: recordInclude, where: { id } });
    });
    if (record === null) {
      throw new ConflictException({ code: 'RECORD_VERSION_CONFLICT', message: '记录已在其他设备更新，请刷新后重试' });
    }
    return serializeRecord(record);
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const result = await this.prisma.foodRecord.updateMany({
      data: { deletedAt: new Date(), version: { increment: 1 } },
      where: { deletedAt: null, id, userId },
    });
    if (result.count !== 1) {
      throw new NotFoundException({ code: 'RECORD_NOT_FOUND', message: '记录不存在或已删除' });
    }
  }

  private toRecordData(dto: Partial<CreateFoodRecordDto>): RecordScalarData {
    return {
      companionCount: dto.companionCount,
      companions: dto.companions === undefined ? undefined : trimOrNull(dto.companions),
      environmentRating: dto.environmentRating,
      isDraft: dto.isDraft,
      isFavorite: dto.isFavorite,
      isRecommended: dto.isRecommended,
      mealAt: dto.mealAt === undefined ? undefined : new Date(dto.mealAt),
      notes: dto.notes === undefined ? undefined : trimOrNull(dto.notes),
      overallRating: dto.overallRating,
      perCapitaPrice: dto.perCapitaPrice,
      serviceRating: dto.serviceRating,
      status: dto.status,
      summary: dto.summary === undefined ? undefined : trimOrNull(dto.summary),
      tasteRating: dto.tasteRating,
      totalPrice: dto.totalPrice,
      valueRating: dto.valueRating,
      visitedAt: dto.visitedAt === undefined ? undefined : toVisitedDate(dto.visitedAt),
      wouldRevisit: dto.wouldRevisit,
    };
  }

  private async replaceTagsAndDishes(
    transaction: Prisma.TransactionClient,
    userId: string,
    recordId: string,
    tags: string[],
    dishes: CreateFoodRecordDto['dishes'],
  ): Promise<void> {
    await transaction.recordTag.deleteMany({ where: { recordId, userId } });
    await transaction.dishRecord.deleteMany({ where: { recordId, userId } });
    const uniqueTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 10);
    for (const [index, name] of uniqueTags.entries()) {
      const normalizedName = name.toLocaleLowerCase('zh-CN');
      const tag = await transaction.tag.upsert({
        create: { name, normalizedName, userId },
        update: { name },
        where: { userId_normalizedName: { normalizedName, userId } },
      });
      await transaction.recordTag.create({ data: { recordId, tagId: tag.id, userId } });
      if (index >= 9) {
        break;
      }
    }
    const uniqueDishes = new Set<string>();
    for (const [index, dish] of dishes.entries()) {
      const name = dish.name.trim();
      const normalizedName = name.toLocaleLowerCase('zh-CN');
      const key = `${dish.type}:${normalizedName}`;
      if (name.length === 0 || uniqueDishes.has(key)) {
        continue;
      }
      uniqueDishes.add(key);
      await transaction.dishRecord.create({
        data: { name, normalizedName, recordId, sortOrder: index, type: dish.type, userId },
      });
    }
  }
}
