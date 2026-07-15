import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { ApiResponseInterceptor } from './common/http/api-response.interceptor';
import { RequestTimeoutInterceptor } from './common/http/request-timeout.interceptor';
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor';

export function configureApplication(app: INestApplication): void {
  const config = app.get(ConfigService);
  const prefix = config.getOrThrow<string>('API_PREFIX');

  app.enableShutdownHooks();
  app.setGlobalPrefix(prefix);
  const expressApp = app as NestExpressApplication;
  const requestLimit = `${config.getOrThrow<number>('REQUEST_BODY_LIMIT_KB')}kb`;
  expressApp.use(json({ limit: requestLimit }));
  expressApp.use(urlencoded({ extended: false, limit: requestLimit }));
  expressApp.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  const corsOrigins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0) {
    app.enableCors({
      allowedHeaders: ['authorization', 'content-type', 'x-request-id'],
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      origin: corsOrigins,
    });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter(config));
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(),
    new RequestTimeoutInterceptor(),
    new ApiResponseInterceptor(),
  );

  if (config.getOrThrow<boolean>('SWAGGER_ENABLED')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('食藏录 FoodTrace API')
      .setDescription('食藏录私人美食记录服务')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
      useGlobalPrefix: true,
    });
  }
}
