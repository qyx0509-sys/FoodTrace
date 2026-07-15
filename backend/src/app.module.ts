import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';

import { validateEnvironment } from './config/environment.validation';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { RequestIdMiddleware } from './common/http/request-id.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { RecordsModule } from './modules/records/records.module';
import { StoresModule } from './modules/stores/stores.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: resolve(__dirname, '../../.env'),
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    RecordsModule,
    StoresModule,
    UsersModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
