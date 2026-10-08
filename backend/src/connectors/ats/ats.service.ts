import { Injectable, Logger } from '@nestjs/common';
import { PipelineService } from '../../queues/pipeline/pipeline.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface AtsCompanyTarget {
  platform: 'greenhouse' | 'lever' | 'ashby' | 'workable';
  slug: string;
}

export interface AtsSyncResult {
  companiesChecked: number;
  /** Postings found on the boards (before filtering). */
  jobsFound: number;
  /** Postings newly queued for processing. */
  jobsEnqueued: number;
  /** Postings skipped because the user already tracks that URL. */
  duplicatesSkipped: number;
  /** Postings skipped because the location did not match the user's filters. */
  locationFiltered: number;
  errors: string[];
}

interface AtsJob {
  url: string;
  location: string;
  rawText: string;
}

/** Location filter aliases so "Saudi Arabia" also matches "Riyadh", etc. */
const LOCATION_ALIASES: Record<string, string[]> = {
  'saudi arabia': ['saudi arabia', 'saudi', 'ksa', 'riyadh', 'jeddah', 'dammam', 'khobar', 'neom'],
  uae: ['uae', 'united arab emirates', 'dubai', 'abu dhabi', 'sharjah'],
  qatar: ['qatar', 'doha'],
  kuwait: ['kuwait'],
  bahrain: ['bahrain', 'manama'],
  oman: ['oman', 'muscat'],
  gcc: ['gcc', 'saudi', 'ksa', 'riyadh', 'jeddah', 'uae', 'dubai', 'abu dhabi', 'qatar', 'doha', 'kuwait', 'bahrain', 'oman'],
  remote: ['remote', 'anywhere', 'worldwide', 'work from home'],
  europe: [
    'europe', 'emea', 'uk', 'united kingdom', 'london', 'germany', 'berlin', 'netherlands',
    'amsterdam', 'france', 'paris', 'spain', 'madrid', 'barcelona', 'ireland', 'dublin',
    'portugal', 'lisbon', 'sweden', 'stockholm', 'poland', 'warsaw',
  ],
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True if the posting location matches any filter. Empty filters match everything.
 * An unknown/empty posting location is kept (we cannot prove it is outside the target).
 */
export function matchesLocationFilters(location: string, filters: string[]): boolean {
  const cleaned = filters.map((f) => f.trim().toLowerCase()).filter(Boolean);
  if (cleaned.length === 0) return true;
  const loc = location.trim().toLowerCase();
  if (!loc || loc === 'unknown') return true;

  return cleaned.some((filter) => {
    const terms = LOCATION_ALIASES[filter] ?? [filter];
    return terms.some((t) => new RegExp(`\\b${escapeRegex(t)}\\b`, 'i').test(loc));
  });
}

@Injectable()
export class AtsService {
  private readonly logger = new Logger(AtsService.name);

  // Default curated tech targets (used only when the user has not configured any)
  private defaultTargets: AtsCompanyTarget[] = [
    { platform: 'greenhouse', slug: 'careem' },
    { platform: 'greenhouse', slug: 'noon' },
    { platform: 'greenhouse', slug: 'tabby' },
    { platform: 'greenhouse', slug: 'tamara' },
    { platform: 'lever', slug: 'jahez' },
    { platform: 'lever', slug: 'hungerstation' },
  ];

  constructor(
    private readonly pipeline: PipelineService,
    private readonly prisma: PrismaService,
  ) {}

  getDefaultTargets(): AtsCompanyTarget[] {
    return this.defaultTargets;
  }

  /**
   * Sync open postings from public ATS boards (Greenhouse + Lever).
   * Targets and location filters come from the user's saved preferences.
   * Rate limited to 1 request per second; fails soft per company.
   */
  async syncAtsPostings(
    userId: string,
    customTargets?: AtsCompanyTarget[],
  ): Promise<AtsSyncResult> {
    const prefs = await this.prisma.jobPreference.findUnique({ where: { userId } });
    const savedTargets = Array.isArray(prefs?.atsTargets)
      ? (prefs.atsTargets as unknown as AtsCompanyTarget[])
      : [];
    const filters = Array.isArray(prefs?.locationFilters)
      ? (prefs.locationFilters as unknown as string[])
      : [];

    const targets =
      customTargets && customTargets.length > 0
        ? customTargets
        : savedTargets.length > 0
          ? savedTargets
          : this.defaultTargets;

    const result: AtsSyncResult = {
      companiesChecked: 0,
      jobsFound: 0,
      jobsEnqueued: 0,
      duplicatesSkipped: 0,
      locationFiltered: 0,
      errors: [],
    };

    this.logger.log(
      `Starting ATS sync for ${targets.length} companies (location filters: ${filters.join(', ') || 'none'})...`,
    );

    for (const target of targets) {
      result.companiesChecked++;
      try {
        let jobs: AtsJob[] = [];
        if (target.platform === 'greenhouse') {
          jobs = await this.fetchGreenhouse(target.slug);
        } else if (target.platform === 'lever') {
          jobs = await this.fetchLever(target.slug);
        } else if (target.platform === 'ashby') {
          jobs = await this.fetchAshby(target.slug);
        } else if (target.platform === 'workable') {
          jobs = await this.fetchWorkable(target.slug);
        }
        result.jobsFound += jobs.length;
        await this.ingest(userId, jobs, filters, result);
      } catch (err: unknown) {
        const msg = `Error fetching ATS for ${target.platform}:${target.slug}: ${String(err)}`;
        this.logger.warn(msg);
        result.errors.push(msg);
      }

      // Respect 1 req/sec rate limit per docs/PLAN.md §2.3
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.logger.log(
      `ATS sync complete: ${result.companiesChecked} companies, ${result.jobsFound} found, ` +
        `${result.jobsEnqueued} new, ${result.duplicatesSkipped} duplicates, ${result.locationFiltered} filtered by location`,
    );

    return result;
  }

  private async ingest(
    userId: string,
    jobs: AtsJob[],
    filters: string[],
    result: AtsSyncResult,
  ): Promise<void> {
    const locationOk = jobs.filter((j) => {
      const ok = matchesLocationFilters(j.location, filters);
      if (!ok) result.locationFiltered++;
      return ok;
    });
    if (locationOk.length === 0) return;

    const existing = await this.prisma.opportunity.findMany({
      where: { userId, url: { in: locationOk.map((j) => j.url) } },
      select: { url: true },
    });
    const known = new Set(existing.map((e) => e.url));

    for (const job of locationOk) {
      if (known.has(job.url)) {
        result.duplicatesSkipped++;
        continue;
      }
      await this.pipeline.addJob({
        userId,
        rawText: job.rawText,
        url: job.url,
        type: 'JOB',
        sourceType: 'ATS',
      });
      known.add(job.url);
      result.jobsEnqueued++;
    }
  }

  private async fetchGreenhouse(slug: string): Promise<AtsJob[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
      if (res.status === 404) {
        this.logger.debug(`Greenhouse board not found for ${slug}`);
        return [];
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

    return (data.jobs ?? []).map((job) => {
      const cleanContent = (job.content ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();
      const location = job.location?.name ?? 'Unknown';
      return {
        url: job.absolute_url,
        location,
        rawText: [
          `Job Title: ${job.title}`,
          `Company: ${slug}`,
          `Location: ${location}`,
          `Application URL: ${job.absolute_url}`,
          `Description:\n${cleanContent.slice(0, 4000)}`,
        ].join('\n'),
      };
    });
  }

  private async fetchLever(slug: string): Promise<AtsJob[]> {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
      if (res.status === 404) {
        this.logger.debug(`Lever board not found for ${slug}`);
        return [];
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

    if (!Array.isArray(data)) return [];

    return data.map((item) => {
      const location = item.categories?.location ?? 'Unknown';
      return {
        url: item.hostedUrl,
        location,
        rawText: [
          `Job Title: ${item.text}`,
          `Company: ${slug}`,
          `Location: ${location}`,
          `Team: ${item.categories?.team ?? 'Engineering'}`,
          `Commitment: ${item.categories?.commitment ?? 'Full-time'}`,
          `Application URL: ${item.hostedUrl}`,
          `Description:\n${(item.descriptionPlain ?? '').slice(0, 4000)}`,
        ].join('\n'),
      };
    });
  }

  private async fetchAshby(slug: string): Promise<AtsJob[]> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 400) {
        this.logger.debug(`Ashby board not found for ${slug}`);
        return [];
      }
      throw new Error(`Ashby API responded with HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      jobs?: Array<{
        id: string;
        title: string;
        department?: string;
        location?: string;
        isRemote?: boolean;
        jobUrl?: string;
        descriptionPlain?: string;
        descriptionHtml?: string;
      }>;
    };

    return (data.jobs ?? []).map((job) => {
      const loc = job.location || (job.isRemote ? 'Remote' : 'Unknown');
      const cleanDesc = (job.descriptionPlain ?? (job.descriptionHtml ?? '').replace(/<[^>]+>/g, ' '))
        .replace(/&nbsp;/g, ' ')
        .trim();
      const jobUrl = job.jobUrl || `https://jobs.ashbyhq.com/${slug}/${job.id}`;

      return {
        url: jobUrl,
        location: loc,
        rawText: [
          `Job Title: ${job.title}`,
          `Company: ${slug}`,
          `Location: ${loc}`,
          `Department: ${job.department ?? 'Engineering'}`,
          `Application URL: ${jobUrl}`,
          `Description:\n${cleanDesc.slice(0, 4000)}`,
        ].join('\n'),
      };
    });
  }

  private async fetchWorkable(slug: string): Promise<AtsJob[]> {
    const url = `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
      if (res.status === 404) {
        this.logger.debug(`Workable board not found for ${slug}`);
        return [];
      }
      throw new Error(`Workable API responded with HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      jobs?: Array<{
        title: string;
        shortcode: string;
        city?: string;
        country?: string;
        telecommuting?: boolean;
        description?: string;
        url?: string;
      }>;
    };

    return (data.jobs ?? []).map((job) => {
      const loc = [job.city, job.country].filter(Boolean).join(', ') || (job.telecommuting ? 'Remote' : 'Unknown');
      const cleanDesc = (job.description ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();
      const jobUrl = job.url || `https://apply.workable.com/${slug}/j/${job.shortcode}`;

      return {
        url: jobUrl,
        location: loc,
        rawText: [
          `Job Title: ${job.title}`,
          `Company: ${slug}`,
          `Location: ${loc}`,
          `Application URL: ${jobUrl}`,
          `Description:\n${cleanDesc.slice(0, 4000)}`,
        ].join('\n'),
      };
    });
  }
}
