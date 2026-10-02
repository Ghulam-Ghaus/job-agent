import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailService, EmailSyncResult } from './email/email.service.js';
import { AtsService, AtsSyncResult } from './ats/ats.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface FullSyncSummary {
  email: EmailSyncResult;
  ats: AtsSyncResult;
  timestamp: string;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly atsService: AtsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Run daily ingestion at 08:00, 14:00, and 20:00 per PLAN §2.1 & §11
   */
  @Cron('0 8,14,20 * * *')
  async handleScheduledSync(): Promise<void> {
    this.logger.log('Cron triggered: Starting scheduled job ingestion (Email + ATS)...');

    // Get active users
    const users = await this.prisma.user.findMany({
      select: { id: true },
      take: 10,
    });

    for (const u of users) {
      try {
        await this.syncAll(u.id);
      } catch (err: unknown) {
        this.logger.error(`Scheduled sync failed for user ${u.id}: ${String(err)}`);
      }
    }
  }

  /**
   * Run full sync for a specific user (can be called manually or by cron)
   */
  async syncAll(userId: string): Promise<FullSyncSummary> {
    this.logger.log(`Starting full connector sync for user ${userId}`);

    const [emailResult, atsResult] = await Promise.all([
      this.emailService.syncAlerts(userId),
      this.atsService.syncAtsPostings(userId),
    ]);

    return {
      email: emailResult,
      ats: atsResult,
      timestamp: new Date().toISOString(),
    };
  }
}
