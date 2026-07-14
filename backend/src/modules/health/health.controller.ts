import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

export interface LiveHealthResponse {
  status: 'ok';
  service: 'foodtrace-api';
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get('live')
  @ApiOperation({ summary: '检查 API 进程是否存活' })
  @ApiOkResponse({
    schema: {
      example: {
        service: 'foodtrace-api',
        status: 'ok',
        timestamp: '2026-07-14T12:30:00.000Z',
      },
    },
  })
  getLive(): LiveHealthResponse {
    return {
      service: 'foodtrace-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
