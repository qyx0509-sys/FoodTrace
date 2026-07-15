import { Transform, Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class PoiSearchQueryDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 50)
  keyword!: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(50_000)
  radiusMeters = 5_000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 20;
}
