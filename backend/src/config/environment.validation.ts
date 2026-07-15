import 'reflect-metadata';

import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65_535)
  PORT = 3000;

  @IsString()
  @MinLength(1)
  API_HOST = '0.0.0.0';

  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/)
  API_PREFIX = 'api/v1';

  @Transform(({ value }: { value: unknown }) => toBoolean(value))
  @IsBoolean()
  SWAGGER_ENABLED = true;

  @IsString()
  CORS_ORIGINS = '';

  @Type(() => Number)
  @IsInt()
  @Min(64)
  @Max(10_240)
  REQUEST_BODY_LIMIT_KB = 1024;

  @IsString()
  @Matches(/^postgres(?:ql)?:\/\/[^\s]+$/)
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @MinLength(1)
  JWT_ISSUER = 'foodtrace-api';

  @IsString()
  @MinLength(1)
  JWT_AUDIENCE = 'foodtrace-client';

  @Type(() => Number)
  @IsInt()
  @Min(60)
  JWT_ACCESS_TTL_SECONDS = 900;

  @Type(() => Number)
  @IsInt()
  @Min(300)
  JWT_REFRESH_TTL_SECONDS = 2_592_000;

  @Transform(({ value }: { value: unknown }) => toBoolean(value))
  @IsBoolean()
  WECHAT_MINI_LOGIN_ENABLED = false;

  @IsOptional()
  @IsString()
  WECHAT_MINI_APP_ID?: string;

  @IsOptional()
  @IsString()
  WECHAT_MINI_APP_SECRET?: string;

  @Transform(({ value }: { value: unknown }) => toBoolean(value))
  @IsBoolean()
  WECHAT_MOBILE_LOGIN_ENABLED = false;

  @IsOptional()
  @IsString()
  WECHAT_MOBILE_APP_ID?: string;

  @IsOptional()
  @IsString()
  WECHAT_MOBILE_APP_SECRET?: string;

  @IsOptional()
  @IsString()
  TENCENT_MAP_WEB_SERVICE_KEY?: string;

  @Transform(({ value }: { value: unknown }) => toBoolean(value))
  @IsBoolean()
  TENCENT_COS_ENABLED = false;

  @Transform(({ value }: { value: unknown }) => toBoolean(value))
  @IsBoolean()
  TENCENT_COS_USE_INSTANCE_ROLE = false;

  @IsOptional()
  @IsString()
  TENCENT_CLOUD_SECRET_ID?: string;

  @IsOptional()
  @IsString()
  TENCENT_CLOUD_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  TENCENT_COS_BUCKET?: string;

  @IsOptional()
  @IsString()
  TENCENT_COS_REGION?: string;
}

function assertConfigured(value: string | undefined, name: string): void {
  if (value === undefined || value.trim().length === 0 || value.includes('REPLACE_ME')) {
    throw new Error(`Environment validation failed: ${name} must be configured`);
  }
}

function validateCorsOrigins(origins: string, production: boolean): void {
  const entries = origins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (production && entries.length === 0) {
    throw new Error('Environment validation failed: production CORS_ORIGINS is required');
  }
  for (const origin of entries) {
    if (origin === '*' || !/^https?:\/\/[^/\s]+(?::\d+)?$/.test(origin)) {
      throw new Error('Environment validation failed: CORS_ORIGINS must be explicit origins');
    }
  }
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const nodeEnvironment = config['NODE_ENV'] ?? NodeEnvironment.Development;
  const normalizedConfig = {
    SWAGGER_ENABLED: nodeEnvironment !== NodeEnvironment.Production,
    ...config,
  };
  const validated = plainToInstance(EnvironmentVariables, normalizedConfig, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors.flatMap((error) => Object.values(error.constraints ?? {})).join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  assertConfigured(validated.DATABASE_URL, 'DATABASE_URL');
  assertConfigured(validated.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');
  assertConfigured(validated.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
  if (validated.JWT_ACCESS_SECRET === validated.JWT_REFRESH_SECRET) {
    throw new Error('Environment validation failed: JWT secrets must be different');
  }

  const production = validated.NODE_ENV === NodeEnvironment.Production;
  validateCorsOrigins(validated.CORS_ORIGINS, production);
  if (production && validated.SWAGGER_ENABLED) {
    throw new Error('Environment validation failed: production Swagger must remain disabled');
  }

  if (validated.WECHAT_MINI_LOGIN_ENABLED) {
    assertConfigured(validated.WECHAT_MINI_APP_ID, 'WECHAT_MINI_APP_ID');
    assertConfigured(validated.WECHAT_MINI_APP_SECRET, 'WECHAT_MINI_APP_SECRET');
  }
  if (validated.WECHAT_MOBILE_LOGIN_ENABLED) {
    assertConfigured(validated.WECHAT_MOBILE_APP_ID, 'WECHAT_MOBILE_APP_ID');
    assertConfigured(validated.WECHAT_MOBILE_APP_SECRET, 'WECHAT_MOBILE_APP_SECRET');
  }
  if (validated.TENCENT_COS_ENABLED) {
    assertConfigured(validated.TENCENT_COS_BUCKET, 'TENCENT_COS_BUCKET');
    assertConfigured(validated.TENCENT_COS_REGION, 'TENCENT_COS_REGION');
    if (!validated.TENCENT_COS_USE_INSTANCE_ROLE) {
      assertConfigured(validated.TENCENT_CLOUD_SECRET_ID, 'TENCENT_CLOUD_SECRET_ID');
      assertConfigured(validated.TENCENT_CLOUD_SECRET_KEY, 'TENCENT_CLOUD_SECRET_KEY');
    }
  }

  return validated;
}
