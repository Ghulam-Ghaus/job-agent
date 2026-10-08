import { Controller, Post, Body } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SchedulerService, FullSyncSummary } from './scheduler.service.js';
import { EmailService, EmailSyncResult } from './email/email.service.js';
import { AtsService, AtsSyncResult, AtsCompanyTarget } from './ats/ats.service.js';
import { AtsDetectorService, AtsDetectionResult } from './ats/ats-detector.service.js';
import { DetectAtsDto, AddAtsTargetDto } from './ats/dto/detect-ats.dto.js';

@ApiTags('Connectors')
@ApiCookieAuth('accessToken')
@Controller('connectors')
export class ConnectorsController {
  constructor(
    private readonly scheduler: SchedulerService,
    private readonly email: EmailService,
    private readonly ats: AtsService,
    private readonly atsDetector: AtsDetectorService,
    private readonly prisma: PrismaService,
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

  @Post('ats/detect')
  @ApiOperation({ summary: 'Detect ATS provider and slug from company careers page URL' })
  async detectAts(@Body() dto: DetectAtsDto): Promise<AtsDetectionResult> {
    return this.atsDetector.detect(dto.url);
  }

  @Post('ats/targets/add')
  @ApiOperation({ summary: 'Add a detected ATS board to user scan list' })
  async addAtsTarget(
    @CurrentUser('id') userId: string,
    @Body() dto: AddAtsTargetDto,
  ) {
    const prefs = await this.prisma.jobPreference.findUnique({ where: { userId } });
    const existingTargets = Array.isArray(prefs?.atsTargets)
      ? (prefs.atsTargets as unknown as AtsCompanyTarget[])
      : [];

    const alreadyExists = existingTargets.some(
      (t) => t.platform === dto.platform && t.slug.toLowerCase() === dto.slug.toLowerCase(),
    );

    if (alreadyExists) {
      return { success: true, targets: existingTargets, added: false };
    }

    const updatedTargets = [...existingTargets, { platform: dto.platform, slug: dto.slug.toLowerCase() }];
    await this.prisma.jobPreference.upsert({
      where: { userId },
      create: {
        userId,
        atsTargets: updatedTargets as any,
      },
      update: {
        atsTargets: updatedTargets as any,
      },
    });

    return { success: true, targets: updatedTargets, added: true };
  }
}
