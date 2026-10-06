import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOpportunityDto } from './dto/create-opportunity.dto.js';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto.js';
import { ExtractionService } from './extraction.service.js';
import { ScoringService } from './scoring.service.js';
import { EligibilityRulesService } from './rules/eligibility-rules.service.js';

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: ExtractionService,
    private readonly scoring: ScoringService,
    private readonly eligibility: EligibilityRulesService,
  ) {}

  /** Manually ingest → extract → score. Dedup by content hash. */
  async create(userId: string, dto: CreateOpportunityDto) {
    let rawText = dto.text ?? '';
    const targetUrl = dto.url;

    if (!rawText && targetUrl) {
      try {
        const fetched = await this.fetchWebpageContent(targetUrl);
        // If this was a search results page and individual job links were discovered:
        if (fetched.individualJobUrls && fetched.individualJobUrls.length > 0) {
          this.logger.log(`Discovered ${fetched.individualJobUrls.length} individual jobs in search page ${targetUrl}`);
          const ingested = [];
          for (const indUrl of fetched.individualJobUrls.slice(0, 8)) {
            const oppResult = await this.createSingleFromUrl(userId, indUrl, dto.type);
            if (oppResult) ingested.push(oppResult);
          }
          if (ingested.length > 0) {
            return ingested[0];
          }
        }
        rawText = fetched.text || targetUrl;
      } catch (err: unknown) {
        this.logger.warn(`Could not fetch web content for ${targetUrl}: ${String(err)}`);
        rawText = targetUrl;
      }
    }

    if (!rawText) {
      rawText = targetUrl ?? '';
    }

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
      update: { url: dto.url },
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

        // ── 2.5 Eligibility filter (Feature 1) ──────────────────────────
        const eligibility = this.eligibility.evaluate({
          title: fields.title ?? opp.title,
          rawText: opp.rawText,
          postedAt: opp.postedAt,
          yearsRequired: fields.yearsExp,
          skillsRequired: fields.skills?.map((s) => s.name),
        });

        if (eligibility.isFilteredOut) {
          this.logger.warn(`Opp ${opp.id} hard-rejected: ${eligibility.filterReason}`);
          await this.prisma.opportunity.update({
            where: { id: opp.id },
            data: {
              status: 'FILTERED_OUT',
              filterReason: eligibility.filterReason,
              filterFlags: [],
              scoreAdjustments: [],
            },
          });
          return this.prisma.opportunity.findUnique({
            where: { id: opp.id },
            include: { requirement: true, match: true, applyPack: true },
          });
        }

        await this.prisma.opportunity.update({
          where: { id: opp.id },
          data: {
            filterFlags: eligibility.softFlags,
            scoreAdjustments: eligibility.scoreAdjustments as object[],
          },
        });

        // ── 3. Score against user profile ─────────────────────────────────
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

  private async createSingleFromUrl(userId: string, url: string, type?: 'JOB' | 'FREELANCE' | 'LEAD') {
    try {
      const fetched = await this.fetchWebpageContent(url);
      const rawText = fetched.text || url;
      const contentHash = createHash('sha256').update(rawText).digest('hex');

      const opp = await this.prisma.opportunity.upsert({
        where: { userId_contentHash: { userId, contentHash } },
        create: {
          userId,
          contentHash,
          rawText,
          url,
          type: type ?? 'JOB',
          sourceType: 'MANUAL',
        },
        update: { url },
      });

      const existingReq = await this.prisma.opportunityRequirement.findUnique({
        where: { opportunityId: opp.id },
      });

      if (!existingReq) {
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

        const eligibility = this.eligibility.evaluate({
          title: fields.title ?? opp.title,
          rawText: opp.rawText,
          postedAt: opp.postedAt,
          yearsRequired: fields.yearsExp,
          skillsRequired: fields.skills?.map((s) => s.name),
        });

        if (eligibility.isFilteredOut) {
          this.logger.warn(`Opp ${opp.id} from URL ${url} hard-rejected: ${eligibility.filterReason}`);
          await this.prisma.opportunity.update({
            where: { id: opp.id },
            data: {
              status: 'FILTERED_OUT',
              filterReason: eligibility.filterReason,
              filterFlags: [],
              scoreAdjustments: [],
            },
          });
          return this.prisma.opportunity.findUnique({
            where: { id: opp.id },
            include: { requirement: true, match: true, applyPack: true },
          });
        }

        await this.prisma.opportunity.update({
          where: { id: opp.id },
          data: {
            filterFlags: eligibility.softFlags,
            scoreAdjustments: eligibility.scoreAdjustments as object[],
          },
        });

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
      }

      return this.prisma.opportunity.findUnique({
        where: { id: opp.id },
        include: { requirement: true, match: true, applyPack: true },
      });
    } catch (err: unknown) {
      this.logger.error(`Failed to ingest single job from URL ${url}: ${String(err)}`);
      return null;
    }
  }

  /**
   * User override for an opportunity that was filtered out.
   * Restores status to QUALIFIED, removes filterReason, and recalculates score.
   */
  async overrideFilter(id: string, userId: string) {
    const opp = await this.prisma.opportunity.findFirst({
      where: { id, userId },
      include: { requirement: true },
    });
    if (!opp) throw new NotFoundException(`Opportunity ${id} not found`);

    const fields = (opp.requirement?.fieldsJson as any) || { title: opp.title, rawText: opp.rawText };
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

    return this.prisma.opportunity.update({
      where: { id },
      data: {
        status: 'QUALIFIED',
        filterReason: null,
      },
      include: { requirement: true, match: true, applyPack: true },
    });
  }

  private async fetchWebpageContent(url: string): Promise<{ text: string; individualJobUrls?: string[] }> {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    const isSearchPage = url.includes('/search') || url.includes('/jobs?') || url.includes('query=');
    const individualJobUrls: string[] = [];

    if (isSearchPage) {
      const linkRegex = /href=["'](https?:\/\/[^"']*(?:workable\.com\/view|lever\.co\/|greenhouse\.io\/)[^"']+|\/view\/[a-zA-Z0-9_-]+|\/jobs\/[a-zA-Z0-9_-]+)["']/gi;
      let match;
      const seen = new Set<string>();
      while ((match = linkRegex.exec(html)) !== null) {
        let link = match[1];
        if (link.startsWith('/')) {
          try {
            const origin = new URL(url).origin;
            link = `${origin}${link}`;
          } catch {
            // ignore
          }
        }
        if (!seen.has(link) && !link.includes('/search')) {
          seen.add(link);
          individualJobUrls.push(link);
        }
      }
    }

    const cleanText = this.stripHtml(html);
    return {
      text: cleanText.slice(0, 15000),
      individualJobUrls: individualJobUrls.length > 0 ? individualJobUrls : undefined,
    };
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<(?:p|div|h[1-6]|li|br|tr)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();
  }
}
