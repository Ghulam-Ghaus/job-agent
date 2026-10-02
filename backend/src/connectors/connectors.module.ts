import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueuesModule } from '../queues/queues.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EmailService } from './email/email.service.js';
import { AtsService } from './ats/ats.service.js';
import { SchedulerService } from './scheduler.service.js';
import { ConnectorsController } from './connectors.controller.js';

@Module({
  imports: [ConfigModule, QueuesModule, PrismaModule],
  controllers: [ConnectorsController],
  providers: [EmailService, AtsService, SchedulerService],
  exports: [EmailService, AtsService, SchedulerService],
})
export class ConnectorsModule {}
