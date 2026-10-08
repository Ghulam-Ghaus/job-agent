import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ExtractionService,
  JobRequirementFields,
} from '../../opportunities/extraction.service.js';
import { ScoringService } from '../../opportunities/scoring.service.js';
import { ApplyPackService } from '../../opportunities/apply-pack.service.js';
import { EligibilityRulesService } from '../../opportunities/rules/eligibility-rules.service.js';
import { OutreachService } from '../../opportunities/outreach/outreach.service.js';
import { TelegramService } from '../../telegram/telegram.service.js';

export interface ProcessJobData {
  userId: string;
  rawText: string;
  url?: string;
  type?: 'JOB' | 'FREELANCE' | 'LEAD';
  sourceType?: string;
}

@Processor('job-pipeline')
export class JobProcessorService extends WorkerHost {
  private readonly logger = new Logger(JobProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: ExtractionService,
    private readonly scoring: ScoringService,
    private readonly applyPack: ApplyPackService,
    private readonly telegram: TelegramService,
    private readonly eligibility: EligibilityRulesService,
    private readonly outreach: OutreachService,
  ) {
    super();
  }

  async process(job: Job<ProcessJobData>): Promise<{
    opportunityId: string;
    score: number;
    applyPackCreated: boolean;
  }> {
    const { userId, rawText, url, type = 'JOB', sourceType = 'MANUAL' } = job.data;
    this.logger.log(`Processing job ${job.id} for user ${userId}`);

    // 1. Dedupe by contentHash
    const contentHash = createHash('sha256').update(rawText || url || '').digest('hex');
    const opp = await this.prisma.opportunity.upsert({
      where: { userId_contentHash: { userId, contentHash } },
      create: {
        userId,
        contentHash,
        rawText,
        url,
        type,
        sourceType,
        status: 'DISCOVERED',
      },
      update: {},
    });

    // 2. Extract requirements if not already extracted
    let fields: JobRequirementFields;
    const existingReq = await this.prisma.opportunityRequirement.findUnique({
      where: { opportunityId: opp.id },
    });

    if (!existingReq) {
      try {
        const extractionResult = await this.extraction.extractRequirements(rawText, userId);
        fields = extractionResult.fields;
        await this.prisma.opportunityRequirement.create({
          data: {
            opportunityId: opp.id,
            fieldsJson: extractionResult.fields as object,
            evidenceJson: extractionResult.evidence as object,
            promptVersion: extractionResult.promptVersion ?? 'v1',
            model: extractionResult.model ?? 'unknown',
          },
        });

        await this.prisma.opportunity.update({
          where: { id: opp.id },
          data: {
            title: extractionResult.fields.title ?? opp.title,
            company: extractionResult.fields.company ?? opp.company,
            country: extractionResult.fields.country ?? opp.country,
            city: extractionResult.fields.city ?? opp.city,
            status: 'QUALIFIED',
          },
        });
      } catch (err: unknown) {
        this.logger.error(`Extraction failed for opp ${opp.id}: ${String(err)}`);
        throw err;
      }
    } else {
      fields = existingReq.fieldsJson as unknown as JobRequirementFields;
    }

    // ── Cross-source Deduplication (Extra 1) ──────────────────────────
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const cNorm = norm(fields.company ?? opp.company ?? '');
    const tNorm = norm(fields.title ?? opp.title ?? '');
    const lNorm = norm(fields.country ?? opp.country ?? opp.city ?? '');
    const fingerprint = cNorm && tNorm ? `${cNorm}:::${tNorm}:::${lNorm}` : null;

    if (fingerprint) {
      const existingDuplicate = await this.prisma.opportunity.findFirst({
        where: {
          userId,
          fingerprint,
          id: { not: opp.id },
          status: { notIn: ['FILTERED_OUT', 'CLOSED', 'WITHDRAWN'] },
        },
      });

      if (existingDuplicate) {
        const currentLen = opp.rawText?.length || 0;
        const existingLen = existingDuplicate.rawText?.length || 0;

        if (existingLen >= currentLen) {
          // Existing record already has an equal or more comprehensive description
          this.logger.log(`Opp ${opp.id} deduplicated: already tracked by ${existingDuplicate.id} (${existingDuplicate.sourceType})`);
          await this.prisma.opportunity.update({
            where: { id: opp.id },
            data: {
              status: 'CLOSED',
              fingerprint,
              filterReason: `Duplicate posting of ${existingDuplicate.title ?? 'job'} at ${existingDuplicate.company ?? 'company'} (already tracked from ${existingDuplicate.sourceType || 'ATS'})`,
            },
          });
          return {
            opportunityId: opp.id,
            score: 0,
            applyPackCreated: false,
          };
        } else {
          // New posting has richer description: supersede older record
          await this.prisma.opportunity.update({
            where: { id: existingDuplicate.id },
            data: {
              status: 'CLOSED',
              filterReason: `Superseded by richer description from ${opp.sourceType || 'source'}`,
            },
          });
        }
      }

      await this.prisma.opportunity.update({
        where: { id: opp.id },
        data: { fingerprint },
      });
    }

    // ── Eligibility filter (Feature 1) ──────────────────────────────────
    const eligibility = this.eligibility.evaluate({
      title: fields.title ?? opp.title,
      rawText: opp.rawText,
      postedAt: opp.postedAt,
      yearsRequired: fields.yearsExp,
      skillsRequired: fields.skills?.map((s) => s.name),
    });

    if (eligibility.isFilteredOut) {
      this.logger.warn(
        `Opp ${opp.id} hard-rejected by eligibility rule '${eligibility.matchedRule}': ${eligibility.filterReason}`,
      );
      await this.prisma.opportunity.update({
        where: { id: opp.id },
        data: {
          status: 'FILTERED_OUT',
          filterReason: eligibility.filterReason,
          filterFlags: [],
          scoreAdjustments: [],
        },
      });
      return {
        opportunityId: opp.id,
        score: 0,
        applyPackCreated: false,
      };
    }

    // Store soft flags and adjustments
    await this.prisma.opportunity.update({
      where: { id: opp.id },
      data: {
        filterFlags: eligibility.softFlags,
        scoreAdjustments: eligibility.scoreAdjustments as object[],
      },
    });

    // 3. Score against user profile (with eligibility boosts / penalties)
    const matchResult = await this.scoring.score(
      userId,
      fields,
      opp.type,
      eligibility.scoreAdjustments,
    );
    await this.prisma.opportunityMatch.upsert({
      where: { opportunityId: opp.id },
      create: {
        opportunityId: opp.id,
        score: matchResult.score,
        breakdownJson: matchResult.breakdown as object,
        gapsJson: matchResult.gaps as object[],
        recommendedCvId: matchResult.recommendedCvId,
      },
      update: {
        score: matchResult.score,
        breakdownJson: matchResult.breakdown as object,
        gapsJson: matchResult.gaps as object[],
        recommendedCvId: matchResult.recommendedCvId,
      },
    });

    // 4. Auto-generate ApplyPack if score >= 80 per PLAN §8 / §11
    let applyPackCreated = false;
    if (matchResult.score >= 80) {
      const existingPack = await this.prisma.applyPack.findUnique({
        where: { opportunityId: opp.id },
      });
      if (!existingPack) {
        try {
          this.logger.log(
            `High score (${matchResult.score} >= 80). Auto-building ApplyPack for opp ${opp.id}`,
          );
          await this.applyPack.buildPack(opp.id, userId);
          applyPackCreated = true;

          // Dispatch Telegram notification card for high match
          try {
            await this.telegram.sendOpportunityCard(userId, opp.id);
          } catch (err: unknown) {
            this.logger.warn(`Failed to dispatch Telegram card for opp ${opp.id}: ${String(err)}`);
          }
        } catch (err: unknown) {
          this.logger.error(`Apply pack generation failed for opp ${opp.id}: ${String(err)}`);
        }
      }
    }

    // 5. Auto-generate Outreach Pack for shortlisted opportunity (Feature 2: score >= 70)
    if (matchResult.score >= 70) {
      try {
        await this.outreach.generateOutreachPack(opp.id, userId, 70);
      } catch (err: unknown) {
        this.logger.warn(`Outreach pack generation failed for opp ${opp.id}: ${String(err)}`);
      }
    }

    // 6. Auto-notification if score >= 75 and posted in last 48 hours (Extra 2)
    const postedTime = opp.postedAt ? new Date(opp.postedAt).getTime() : Date.now();
    const isRecent = Date.now() - postedTime <= 48 * 60 * 60 * 1000;
    if (matchResult.score >= 75 && isRecent) {
      try {
        await this.prisma.notification.create({
          data: {
            userId,
            title: `🎯 Top Fit Job (${matchResult.score}/100): ${fields.title ?? opp.title ?? 'Role'}`,
            body: `${fields.company ?? opp.company ?? 'Company'} · Fit score: ${matchResult.score}/100. Outreach materials prepared.`,
            link: `/dashboard`,
          },
        });
      } catch (err: unknown) {
        this.logger.debug(`Failed to create in-app notification: ${String(err)}`);
      }
    }

    return {
      opportunityId: opp.id,
      score: matchResult.score,
      applyPackCreated,
    };
  }
}
