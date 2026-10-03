import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOpportunityDto } from './dto/create-opportunity.dto.js';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto.js';
import { ExtractionService } from './extraction.service.js';
import { ScoringService } from './scoring.service.js';

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: ExtractionService,
    private readonly scoring: ScoringService,
  ) {}

  /** Manually ingest → extract → score. Dedup by content hash. */
  async create(userId: string, dto: CreateOpportunityDto) {
    const rawText = dto.text ?? dto.url ?? '';
    const contentHash = createHash('sha256').update(rawText).digest('hex');

    // ── 1. Upsert opportunity (idempotent) ─────────────────────────────────
    const opp = await this.prisma.opportunity.upsert({
      where: { userId_contentHash: { userId, contentHash } },
      create: {
        userId,
        contentHash,
        rawText,
        url: dto.url,
        type: dto.type,
        sourceType: 'MANUAL',
      },
      update: {},
    });

    // ── 2. Extract requirements (skip if already done) ─────────────────────
    const existingReq = await this.prisma.opportunityRequirement.findUnique({
      where: { opportunityId: opp.id },
    });

    if (!existingReq) {
      try {
        const extraction = await this.extraction.extractRequirements(rawText, userId);
        const { fields, evidence, promptVersion, model } = extraction;

        await this.prisma.opportunityRequirement.create({
          data: {
            opportunityId: opp.id,
            fieldsJson: fields as object,
            evidenceJson: evidence as object,
            promptVersion: promptVersion ?? 'v1',
            model: model ?? 'unknown',
          },
        });

        // Update opportunity metadata from extraction
        await this.prisma.opportunity.update({
          where: { id: opp.id },
          data: {
            title: fields.title ?? opp.title,
            company: fields.company ?? opp.company,
            country: fields.country ?? opp.country,
            city: fields.city ?? opp.city,
            status: 'QUALIFIED',
          },
        });

        // ── 3. Score against user profile ─────────────────────────────────
        const matchResult = await this.scoring.score(userId, fields, opp.type);
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
      } catch (err: unknown) {
        this.logger.error(`Extraction/scoring failed for opp ${opp.id}: ${String(err)}`);
        // Don't block the response — the opp is saved, extraction can be retried
      }
    }

    // Return the opportunity with all relations
    return this.prisma.opportunity.findUnique({
      where: { id: opp.id },
      include: { requirement: true, match: true, applyPack: true },
    });
  }

  findAll(userId: string) {
    return this.prisma.opportunity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { requirement: true, match: true, applyPack: true },
    });
  }

  async findOne(id: string, userId: string) {
    const opp = await this.prisma.opportunity.findFirst({
      where: { id, userId },
      include: { requirement: true, match: true, applyPack: true },
    });
    if (!opp) throw new NotFoundException(`Opportunity ${id} not found`);
    return opp;
  }

  async update(id: string, userId: string, dto: UpdateOpportunityDto) {
    await this.findOne(id, userId);
    return this.prisma.opportunity.update({ where: { id }, data: dto as object });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.opportunity.delete({ where: { id } });
  }

  /** Re-run extraction + scoring on an already-ingested opportunity. */
  async reprocess(id: string, userId: string) {
    const opp = await this.findOne(id, userId);

    // Delete existing requirement so extraction runs fresh
    await this.prisma.opportunityRequirement.deleteMany({
      where: { opportunityId: id },
    });

    try {
      const extraction = await this.extraction.extractRequirements(opp.rawText, userId);
      const { fields, evidence, promptVersion, model } = extraction;

      await this.prisma.opportunityRequirement.create({
        data: {
          opportunityId: id,
          fieldsJson: fields as object,
          evidenceJson: evidence as object,
          promptVersion: promptVersion ?? 'v1',
          model: model ?? 'unknown',
        },
      });

      await this.prisma.opportunity.update({
        where: { id },
        data: {
          title: fields.title ?? opp.title,
          company: fields.company ?? opp.company,
          country: fields.country ?? opp.country,
          city: fields.city ?? opp.city,
          status: 'QUALIFIED',
        },
      });

      const matchResult = await this.scoring.score(userId, fields, opp.type);
      await this.prisma.opportunityMatch.upsert({
        where: { opportunityId: id },
        create: {
          opportunityId: id,
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
    } catch (err: unknown) {
      this.logger.error(`Reprocess failed for opp ${id}: ${String(err)}`);
      throw err;
    }

    return this.findOne(id, userId);
  }
}
