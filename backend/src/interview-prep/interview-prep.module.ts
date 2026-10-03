import { Module } from '@nestjs/common';
import { InterviewPrepService } from './interview-prep.service.js';
import { InterviewPrepController } from './interview-prep.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LlmModule } from '../llm/llm.module.js';

@Module({
  imports: [PrismaModule, LlmModule],
  controllers: [InterviewPrepController],
  providers: [InterviewPrepService],
  exports: [InterviewPrepService],
})
export class InterviewPrepModule {}
