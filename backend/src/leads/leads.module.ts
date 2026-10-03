import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ConnectorsModule } from '../connectors/connectors.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { LeadsService } from './leads.service.js';
import { LeadsController } from './leads.controller.js';
import { NeedAnalyzerService } from './need-analyzer/need-analyzer.service.js';
import { OutreachService } from './outreach/outreach.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, ConnectorsModule, LlmModule],
  controllers: [LeadsController],
  providers: [LeadsService, NeedAnalyzerService, OutreachService],
  exports: [LeadsService, NeedAnalyzerService, OutreachService],
})
export class LeadsModule {}
