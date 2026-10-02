import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OpportunitiesModule } from '../opportunities/opportunities.module.js';

@Module({
  imports: [PrismaModule, OpportunitiesModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
