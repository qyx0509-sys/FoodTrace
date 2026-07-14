import 'reflect-metadata';

import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
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
  API_HOST = '0.0.0.0';

  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/)
  API_PREFIX = 'api/v1';

  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  SWAGGER_ENABLED = true;

  @IsString()
  @Matches(/^postgres(?:ql)?:\/\/[^\s]+$/)
  DATABASE_URL!: string;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const details = errors.flatMap((error) => Object.values(error.constraints ?? {})).join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  return validated;
}
