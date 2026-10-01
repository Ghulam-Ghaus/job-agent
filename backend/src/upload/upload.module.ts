import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller.js';
import { CvsModule } from '../cvs/cvs.module.js';

@Module({
  imports: [CvsModule],
  controllers: [UploadController],
})
export class UploadModule {}
