import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { NodeEnvironment } from '../../config/environment.validation';
import type { RequestContext } from './request-context';

interface HttpErrorBody {
  code?: unknown;
  error?: unknown;
  message?: unknown;
}

function readHttpError(error: HttpException): { code: string; message: string } {
  const response: unknown = error.getResponse();
  if (typeof response === 'string') {
    return { code: `HTTP_${error.getStatus()}`, message: response };
  }
  if (typeof response === 'object' && response !== null) {
    const body = response as HttpErrorBody;
    const message = Array.isArray(body.message)
      ? body.message.filter((entry): entry is string => typeof entry === 'string').join('; ')
      : typeof body.message === 'string'
        ? body.message
        : error.message;
    return {
      code: typeof body.code === 'string' ? body.code : `HTTP_${error.getStatus()}`,
      message,
    };
  }
  return { code: `HTTP_${error.getStatus()}`, message: error.message };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestContext>();
    const response = context.getResponse<Response>();
    const isHttpError = exception instanceof HttpException;
    const statusCode = isHttpError
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const production = this.config.get<string>('NODE_ENV') === NodeEnvironment.Production;
    const details = isHttpError
      ? readHttpError(exception)
      : {
          code: 'INTERNAL_ERROR',
          message: production ? '服务暂时不可用，请稍后再试' : 'Internal server error',
        };

    response.status(statusCode).json({
      error: {
        code: details.code,
        message: details.message,
        requestId: request.requestId ?? 'unknown',
      },
      success: false,
    });
  }
}
