import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { RecordStatus } from '../../../generated/prisma/client';

export class RecordListQueryDto {
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  favorite?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}
