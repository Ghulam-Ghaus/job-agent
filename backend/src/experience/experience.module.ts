import { Module } from '@nestjs/common';
import { ExperienceService } from './experience.service.js';
import { ExperienceController } from './experience.controller.js';

@Module({
  controllers: [ExperienceController],
  providers: [ExperienceService],
})
export class ExperienceModule {}
