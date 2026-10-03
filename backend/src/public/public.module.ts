import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
