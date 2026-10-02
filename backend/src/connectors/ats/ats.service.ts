import { Injectable, Logger } from '@nestjs/common';
import { PipelineService } from '../../queues/pipeline/pipeline.service.js';

export interface AtsCompanyTarget {
  platform: 'greenhouse' | 'lever';
  slug: string;
}

export interface AtsSyncResult {
  companiesChecked: number;
  jobsEnqueued: number;
  errors: string[];
}

@Injectable()
export class AtsService {
  private readonly logger = new Logger(AtsService.name);

  // Default curated tech targets
  private defaultTargets: AtsCompanyTarget[] = [
    { platform: 'greenhouse', slug: 'careem' },
    { platform: 'greenhouse', slug: 'noon' },
    { platform: 'greenhouse', slug: 'tabby' },
    { platform: 'greenhouse', slug: 'tamara' },
    { platform: 'lever', slug: 'jahez' },
    { platform: 'lever', slug: 'hungerstation' },
  ];

  constructor(private readonly pipeline: PipelineService) {}

  /**
   * Sync open postings from public ATS boards (Greenhouse + Lever).
   * Rate limited to 1 request per second; fails soft per company.
   */
  async syncAtsPostings(
    userId: string,
    customTargets?: AtsCompanyTarget[],
  ): Promise<AtsSyncResult> {
    const targets = customTargets && customTargets.length > 0 ? customTargets : this.defaultTargets;
    const result: AtsSyncResult = {
      companiesChecked: 0,
      jobsEnqueued: 0,
      errors: [],
    };

    this.logger.log(`Starting ATS sync for ${targets.length} target companies...`);

    for (const target of targets) {
      result.companiesChecked++;
      try {
        if (target.platform === 'greenhouse') {
          const count = await this.fetchGreenhouse(target.slug, userId);
          result.jobsEnqueued += count;
        } else if (target.platform === 'lever') {
          const count = await this.fetchLever(target.slug, userId);
          result.jobsEnqueued += count;
        }
      } catch (err: unknown) {
        const msg = `Error fetching ATS for ${target.platform}:${target.slug}: ${String(err)}`;
        this.logger.warn(msg);
        result.errors.push(msg);
      }

      // Respect 1 req/sec rate limit per docs/PLAN.md §2.3
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.logger.log(
      `ATS sync complete: ${result.companiesChecked} checked, ${result.jobsEnqueued} jobs enqueued`,
    );

    return result;
  }

  private async fetchGreenhouse(slug: string, userId: string): Promise<number> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
      if (res.status === 404) {
        this.logger.debug(`Greenhouse board not found for ${slug}`);
        return 0;
      }
      throw new Error(`Greenhouse API responded with HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      jobs?: Array<{
        id: number | string;
        title: string;
        absolute_url: string;
        location?: { name?: string };
        content?: string;
        updated_at?: string;
      }>;
    };

    const jobs = data.jobs ?? [];
    let enqueued = 0;

    for (const job of jobs) {
      const cleanContent = (job.content ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();

      const rawText = [
        `Job Title: ${job.title}`,
        `Company: ${slug}`,
        `Location: ${job.location?.name ?? 'Unknown'}`,
        `Application URL: ${job.absolute_url}`,
        `Description:\n${cleanContent.slice(0, 4000)}`,
      ].join('\n');

      await this.pipeline.addJob({
        userId,
        rawText,
        url: job.absolute_url,
        type: 'JOB',
        sourceType: 'ATS',
      });
      enqueued++;
    }

    return enqueued;
  }

  private async fetchLever(slug: string, userId: string): Promise<number> {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
      if (res.status === 404) {
        this.logger.debug(`Lever board not found for ${slug}`);
        return 0;
      }
      throw new Error(`Lever API responded with HTTP ${res.status}`);
    }

    const data = (await res.json()) as Array<{
      id: string;
      text: string;
      hostedUrl: string;
      categories?: { location?: string; team?: string; commitment?: string };
      descriptionPlain?: string;
    }>;

    if (!Array.isArray(data)) return 0;

    let enqueued = 0;
    for (const item of data) {
      const rawText = [
        `Job Title: ${item.text}`,
        `Company: ${slug}`,
        `Location: ${item.categories?.location ?? 'Unknown'}`,
        `Team: ${item.categories?.team ?? 'Engineering'}`,
        `Commitment: ${item.categories?.commitment ?? 'Full-time'}`,
        `Application URL: ${item.hostedUrl}`,
        `Description:\n${(item.descriptionPlain ?? '').slice(0, 4000)}`,
      ].join('\n');

      await this.pipeline.addJob({
        userId,
        rawText,
        url: item.hostedUrl,
        type: 'JOB',
        sourceType: 'ATS',
      });
      enqueued++;
    }

    return enqueued;
  }
}
