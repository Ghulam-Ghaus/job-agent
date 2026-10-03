import { Module } from '@nestjs/common';
import { TailoredCvService } from './tailored-cv.service.js';
import { TailoredCvController } from './tailored-cv.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { OpportunitiesModule } from '../opportunities/opportunities.module.js';

@Module({
  imports: [PrismaModule, LlmModule, OpportunitiesModule],
  controllers: [TailoredCvController],
  providers: [TailoredCvService],
  exports: [TailoredCvService],
})
export class TailoredCvModule {}
