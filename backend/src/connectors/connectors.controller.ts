import { Controller, Post, Body } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';
import { SchedulerService, FullSyncSummary } from './scheduler.service.js';
import { EmailService, EmailSyncResult } from './email/email.service.js';
import { AtsService, AtsSyncResult, AtsCompanyTarget } from './ats/ats.service.js';

@ApiTags('Connectors')
@ApiCookieAuth('accessToken')
@Controller('connectors')
export class ConnectorsController {
  constructor(
    private readonly scheduler: SchedulerService,
    private readonly email: EmailService,
    private readonly ats: AtsService,
  ) {}

  @Post('sync')
  @ApiOperation({ summary: 'Trigger full on-demand ingestion sync (Email + ATS)' })
  async syncAll(@CurrentUser('id') userId: string): Promise<FullSyncSummary> {
    return this.scheduler.syncAll(userId);
  }

  @Post('email/sync')
  @ApiOperation({ summary: 'Trigger on-demand email alert ingestion' })
  async syncEmail(@CurrentUser('id') userId: string): Promise<EmailSyncResult> {
    return this.email.syncAlerts(userId);
  }

  @Post('ats/sync')
  @ApiOperation({ summary: 'Trigger on-demand ATS job board ingestion' })
  async syncAts(
    @CurrentUser('id') userId: string,
    @Body('targets') customTargets?: AtsCompanyTarget[],
  ): Promise<AtsSyncResult> {
    return this.ats.syncAtsPostings(userId, customTargets);
  }
}
