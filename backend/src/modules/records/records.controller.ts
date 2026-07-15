import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFoodRecordDto, UpdateFoodRecordDto } from './dto/record.dto';
import { RecordListQueryDto } from './dto/record-query.dto';
import { RecordsService } from './records.service';

@ApiTags('records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Post()
  @ApiOperation({ summary: '创建幂等的私人餐厅记录' })
  create(@CurrentUser() auth: AuthenticatedUser, @Body() dto: CreateFoodRecordDto) {
    return this.records.create(auth.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: '分页查询当前用户的有效记录' })
  list(@CurrentUser() auth: AuthenticatedUser, @Query() query: RecordListQueryDto) {
    return this.records.list(auth.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取当前用户记录详情' })
  getOne(
    @CurrentUser() auth: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.records.getOne(auth.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '使用 version 乐观锁更新记录' })
  update(
    @CurrentUser() auth: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFoodRecordDto,
  ) {
    return this.records.update(auth.userId, id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: '微信 wx.request 兼容的记录更新入口，语义与 PATCH 相同' })
  updateFromMiniProgram(
    @CurrentUser() auth: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFoodRecordDto,
  ) {
    return this.records.update(auth.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '软删除当前用户记录' })
  async remove(
    @CurrentUser() auth: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.records.softDelete(auth.userId, id);
  }
}
