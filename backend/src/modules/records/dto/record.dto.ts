import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { DishType, RecordStatus } from '../../../generated/prisma/client';

const amountPattern = /^\d{1,8}(?:\.\d{1,2})?$/;

export class DishInputDto {
  @ApiProperty({ enum: DishType })
  @IsEnum(DishType)
  type!: DishType;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @Length(1, 50)
  name!: string;
}

export class CreateFoodRecordDto {
  @ApiProperty()
  @IsUUID()
  clientRequestId!: string;

  @ApiProperty()
  @IsUUID()
  storeId!: string;

  @ApiProperty({ enum: RecordStatus })
  @IsEnum(RecordStatus)
  status!: RecordStatus;

  @ApiPropertyOptional({ maximum: 5, minimum: 1, multipleOf: 0.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
  overallRating?: number;

  @ApiPropertyOptional({ maximum: 5, minimum: 1, multipleOf: 0.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
  tasteRating?: number;

  @ApiPropertyOptional({ maximum: 5, minimum: 1, multipleOf: 0.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
  environmentRating?: number;

  @ApiPropertyOptional({ maximum: 5, minimum: 1, multipleOf: 0.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
  serviceRating?: number;

  @ApiPropertyOptional({ maximum: 5, minimum: 1, multipleOf: 0.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
  valueRating?: number;

  @ApiPropertyOptional({ example: '58.00', type: String })
  @IsOptional()
  @IsString()
  @Matches(amountPattern)
  perCapitaPrice?: string;

  @ApiPropertyOptional({ example: '116.00', type: String })
  @IsOptional()
  @IsString()
  @Matches(amountPattern)
  totalPrice?: string;

  @ApiPropertyOptional({ example: '2026-07-15' })
  @IsOptional()
  @IsDateString({ strict: true })
  visitedAt?: string;

  @ApiPropertyOptional({ example: '2026-07-15T12:30:00+08:00' })
  @IsOptional()
  @IsDateString()
  mealAt?: string;

  @ApiPropertyOptional({ maximum: 99, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  companionCount?: number;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  companions?: string;

  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  summary?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecommended?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  wouldRevisit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  tags: string[] = [];

  @ApiPropertyOptional({ type: [DishInputDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DishInputDto)
  dishes: DishInputDto[] = [];
}

export class UpdateFoodRecordDto extends PartialType(CreateFoodRecordDto) {
  @ApiProperty({ description: '乐观锁版本号' })
  @IsInt()
  @Min(1)
  version!: number;
}
