import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller.js';
import { CvsModule } from '../cvs/cvs.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { CvParserService } from './cv-parser/cv-parser.service.js';

@Module({
  imports: [CvsModule, LlmModule],
  controllers: [UploadController],
  providers: [CvParserService],
  exports: [CvParserService],
})
export class UploadModule {}
