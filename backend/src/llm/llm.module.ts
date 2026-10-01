import { Module } from '@nestjs/common';
import { LlmService } from './llm.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
