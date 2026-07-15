import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  controllers: [RecordsController],
  imports: [AuthModule],
  providers: [RecordsService],
})
export class RecordsModule {}
