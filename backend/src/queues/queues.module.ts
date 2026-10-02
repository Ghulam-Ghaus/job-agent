import { Redis } from 'ioredis';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { PipelineService } from './pipeline/pipeline.service.js';
import { JobProcessorService } from './job-processor/job-processor.service.js';
import { OpportunitiesModule } from '../opportunities/opportunities.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const rawRedisUrl = config.getOrThrow<string>('REDIS_URL');
        const redisClient = new Redis(rawRedisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        });
        return {
          connection: redisClient as any,
        };
      },
    }),
    BullModule.registerQueue({
      name: 'job-pipeline',
    }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'job-pipeline',
      adapter: BullMQAdapter as any,
    }),
    OpportunitiesModule,
    PrismaModule,
  ],
  providers: [PipelineService, JobProcessorService],
  exports: [PipelineService, BullModule],
})
export class QueuesModule {}
