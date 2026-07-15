import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../../database/prisma.service';

export interface LiveHealthResponse {
  status: 'ok';
  service: 'foodtrace-api';
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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

  @Get('ready')
  @ApiOperation({ summary: '检查 API 与数据库是否可接收流量' })
  async getReady(): Promise<LiveHealthResponse> {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      service: 'foodtrace-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
