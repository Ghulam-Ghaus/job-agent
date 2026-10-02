import { Module } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service.js';
import { OpportunitiesController } from './opportunities.controller.js';
import { ExtractionService } from './extraction.service.js';
import { ScoringService } from './scoring.service.js';
import { ApplyPackService } from './apply-pack.service.js';
import { ApprovalService } from './approval.service.js';
import { LlmModule } from '../llm/llm.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [LlmModule, PrismaModule],
  controllers: [OpportunitiesController],
  providers: [
    OpportunitiesService,
    ExtractionService,
    ScoringService,
    ApplyPackService,
    ApprovalService,
  ],
  exports: [
    OpportunitiesService,
    ExtractionService,
    ScoringService,
    ApplyPackService,
    ApprovalService,
  ],
})
export class OpportunitiesModule {}
