import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import { ProcessJobData } from '../job-processor/job-processor.service.js';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    @InjectQueue('job-pipeline')
    private readonly jobQueue: Queue<ProcessJobData>,
  ) {}

  /**
   * Enqueue a job for background processing:
   * dedupe -> extract -> score -> auto-generate pack if score >= 80
   */
  async addJob(data: ProcessJobData, opts?: JobsOptions) {
    this.logger.log(`Enqueueing job for user ${data.userId}`);
    return this.jobQueue.add('process-job', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
      ...opts,
    });
  }

  /**
   * Enqueue multiple jobs in bulk (e.g. from IMAP or ATS batches)
   */
  async addBulk(items: Array<{ data: ProcessJobData; opts?: JobsOptions }>) {
    this.logger.log(`Enqueueing bulk ${items.length} jobs`);
    const jobs = items.map((item) => ({
      name: 'process-job',
      data: item.data,
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 200,
        ...item.opts,
      },
    }));
    return this.jobQueue.addBulk(jobs);
  }

  /**
   * Get queue health and counts
   */
  async getQueueMetrics() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.jobQueue.getWaitingCount(),
      this.jobQueue.getActiveCount(),
      this.jobQueue.getCompletedCount(),
      this.jobQueue.getFailedCount(),
      this.jobQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }
}
