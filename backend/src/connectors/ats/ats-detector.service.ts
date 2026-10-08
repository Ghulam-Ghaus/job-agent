import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export type AtsProvider =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'smartrecruiters'
  | 'recruitee'
  | 'personio'
  | 'bamboohr';

export interface AtsDetectionResult {
  detected: boolean;
  provider: AtsProvider | null;
  slug: string | null;
  confidence: number;
  apiAvailable: boolean;
  verified?: boolean;
  careersUrl: string;
  source?: 'cache' | 'network';
}

interface InMemoryCacheEntry {
  result: AtsDetectionResult;
  expiresAt: number;
}

@Injectable()
export class AtsDetectorService {
  private readonly logger = new Logger(AtsDetectorService.name);
  private redis: Redis | null = null;
  private readonly inMemoryCache = new Map<string, InMemoryCacheEntry>();
  private lastRequestTime = 0;
  private readonly rateLimitDelayMs = 2000; // 1 req / 2s
  private readonly timeoutMs = 10000; // 10s timeout
  private readonly maxPayloadBytes = 2 * 1024 * 1024; // 2MB max

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          enableOfflineQueue: false,
        });
        this.redis.connect().catch(() => {
          this.logger.warn('Redis connection failed; using in-memory 7-day cache for ATS detector');
          this.redis = null;
        });
      } catch {
        this.redis = null;
      }
    }
  }

  /**
   * Detects the ATS provider and slug for a given careers URL.
   * Respects robots.txt, 10s timeout, 2MB max payload, 1 req/2s rate limit, and 7-day caching.
   */
  async detect(careersUrl: string): Promise<AtsDetectionResult> {
    const normalizedUrl = this.normalizeUrl(careersUrl);
    if (!normalizedUrl) {
      return {
        detected: false,
        provider: null,
        slug: null,
        confidence: 0,
        apiAvailable: false,
        careersUrl,
      };
    }

    // 1. Check 7-day cache
    const cached = await this.getCached(normalizedUrl);
    if (cached) {
      return { ...cached, source: 'cache' };
    }

    // 2. Direct URL check (e.g. user pasted a direct Greenhouse or Lever board link)
    const directMatch = this.detectFromUrl(normalizedUrl);
    if (directMatch && directMatch.slug) {
      const verified = await this.verifySlug(directMatch.provider, directMatch.slug);
      const result: AtsDetectionResult = {
        detected: true,
        provider: directMatch.provider,
        slug: directMatch.slug,
        confidence: verified ? 1.0 : (directMatch.provider === 'greenhouse' || directMatch.provider === 'lever' || directMatch.provider === 'ashby' || directMatch.provider === 'workable') ? 0.65 : 0.85,
        apiAvailable: ['greenhouse', 'lever', 'ashby', 'workable'].includes(directMatch.provider),
        verified,
        careersUrl: normalizedUrl,
        source: 'network',
      };
      await this.setCached(normalizedUrl, result);
      return result;
    }

    // 3. Robots.txt check
    const robotsAllowed = await this.isRobotsAllowed(normalizedUrl);
    if (!robotsAllowed) {
      this.logger.warn(`Fetching disallowed by robots.txt for ${normalizedUrl}`);
      const result: AtsDetectionResult = {
        detected: false,
        provider: null,
        slug: null,
        confidence: 0,
        apiAvailable: false,
        careersUrl: normalizedUrl,
        source: 'network',
      };
      await this.setCached(normalizedUrl, result);
      return result;
    }

    // 4. Rate-limited safe fetch
    await this.throttle();
    const html = await this.fetchPageHtml(normalizedUrl);
    if (!html) {
      const result: AtsDetectionResult = {
        detected: false,
        provider: null,
        slug: null,
        confidence: 0,
        apiAvailable: false,
        careersUrl: normalizedUrl,
        source: 'network',
      };
      await this.setCached(normalizedUrl, result);
      return result;
    }

    // 5. Inspect HTML patterns
    const detected = this.detectFromHtml(html, normalizedUrl);
    if (!detected || !detected.provider) {
      const result: AtsDetectionResult = {
        detected: false,
        provider: null,
        slug: null,
        confidence: 0,
        apiAvailable: false,
        careersUrl: normalizedUrl,
        source: 'network',
      };
      await this.setCached(normalizedUrl, result);
      return result;
    }

    // 6. Verify slug if public API exists
    const hasPublicApi = ['greenhouse', 'lever', 'ashby', 'workable'].includes(detected.provider);
    let verified = false;
    if (hasPublicApi && detected.slug) {
      verified = await this.verifySlug(detected.provider, detected.slug);
    }

    const confidence = verified
      ? 1.0
      : hasPublicApi
      ? 0.7
      : 0.85;

    const finalResult: AtsDetectionResult = {
      detected: true,
      provider: detected.provider,
      slug: detected.slug,
      confidence,
      apiAvailable: hasPublicApi,
      verified,
      careersUrl: normalizedUrl,
      source: 'network',
    };

    await this.setCached(normalizedUrl, finalResult);
    return finalResult;
  }

  // ── DETECTION PATTERNS ──────────────────────────────────────────────────────

  /**
   * Checks whether the URL itself matches a direct ATS board link.
   */
  detectFromUrl(url: string): { provider: AtsProvider; slug: string | null } | null {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname;

      // Greenhouse: boards.greenhouse.io/{slug} or embed/job_board?for={slug}
      if (host.includes('boards.greenhouse.io') || host.includes('greenhouse.io')) {
        const queryFor = parsed.searchParams.get('for');
        if (queryFor) return { provider: 'greenhouse', slug: queryFor.trim().toLowerCase() };
        const match = path.match(/^\/([a-zA-Z0-9_-]+)/);
        if (match && match[1] && match[1] !== 'embed') {
          return { provider: 'greenhouse', slug: match[1].toLowerCase() };
        }
      }

      // Lever: jobs.lever.co/{slug}
      if (host.includes('jobs.lever.co')) {
        const match = path.match(/^\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) return { provider: 'lever', slug: match[1].toLowerCase() };
      }

      // Ashby: jobs.ashbyhq.com/{slug}
      if (host.includes('jobs.ashbyhq.com')) {
        const match = path.match(/^\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) return { provider: 'ashby', slug: match[1].toLowerCase() };
      }

      // Workable: apply.workable.com/{slug} or {slug}.workable.com
      if (host.includes('apply.workable.com')) {
        const match = path.match(/^\/([a-zA-Z0-9_-]+)/);
        if (match && match[1] && match[1] !== 'j') {
          return { provider: 'workable', slug: match[1].toLowerCase() };
        }
      }
      if (host.endsWith('.workable.com')) {
        const sub = host.replace('.workable.com', '');
        if (sub && sub !== 'apply' && sub !== 'www') {
          return { provider: 'workable', slug: sub.toLowerCase() };
        }
      }

      // SmartRecruiters: careers.smartrecruiters.com/{slug}
      if (host.includes('smartrecruiters.com')) {
        const match = path.match(/^\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) return { provider: 'smartrecruiters', slug: match[1].toLowerCase() };
      }

      // Recruitee: {slug}.recruitee.com
      if (host.endsWith('.recruitee.com')) {
        const sub = host.replace('.recruitee.com', '');
        if (sub && sub !== 'www') return { provider: 'recruitee', slug: sub.toLowerCase() };
      }

      // Personio: {slug}.jobs.personio.de or {slug}.jobs.personio.com
      if (host.includes('.personio.')) {
        const match = host.match(/^([a-zA-Z0-9_-]+)\.jobs\.personio\./);
        if (match && match[1]) return { provider: 'personio', slug: match[1].toLowerCase() };
      }

      // BambooHR: {slug}.bamboohr.com/careers
      if (host.endsWith('.bamboohr.com')) {
        const sub = host.replace('.bamboohr.com', '');
        if (sub && sub !== 'www') return { provider: 'bamboohr', slug: sub.toLowerCase() };
      }
    } catch {
      // Invalid URL
    }
    return null;
  }

  /**
   * Scans HTML content for ATS embed scripts, iframes, API endpoints, or links.
   */
  detectFromHtml(html: string, fallbackUrl?: string): { provider: AtsProvider; slug: string | null } | null {
    // 1. Greenhouse patterns
    // e.g. boards.greenhouse.io/embed/job_board?for=careem
    const ghForMatch = html.match(/boards\.greenhouse\.io\/embed\/job_board\?for=([a-zA-Z0-9_-]+)/i);
    if (ghForMatch?.[1]) return { provider: 'greenhouse', slug: ghForMatch[1].toLowerCase() };

    const ghBoardMatch = html.match(/boards\.greenhouse\.io\/([a-zA-Z0-9_-]+)/i);
    if (ghBoardMatch?.[1] && ghBoardMatch[1] !== 'embed' && ghBoardMatch[1] !== 'js') {
      return { provider: 'greenhouse', slug: ghBoardMatch[1].toLowerCase() };
    }

    if (html.includes('greenhouse-job-board') || html.includes('gh_jid') || html.includes('grnh.se')) {
      const slugMatch = html.match(/data-board=["']([a-zA-Z0-9_-]+)["']/i) ||
                         html.match(/data-greenhouse-board=["']([a-zA-Z0-9_-]+)["']/i);
      return { provider: 'greenhouse', slug: slugMatch?.[1]?.toLowerCase() ?? this.extractSlugFallback(fallbackUrl) };
    }

    // 2. Lever patterns
    // e.g. jobs.lever.co/careem or data-lever-site="careem"
    const leverMatch = html.match(/jobs\.lever\.co\/([a-zA-Z0-9_-]+)/i);
    if (leverMatch?.[1]) return { provider: 'lever', slug: leverMatch[1].toLowerCase() };

    const leverDataMatch = html.match(/data-lever-site=["']([a-zA-Z0-9_-]+)["']/i);
    if (leverDataMatch?.[1]) return { provider: 'lever', slug: leverDataMatch[1].toLowerCase() };

    // 3. Ashby patterns
    // e.g. jobs.ashbyhq.com/salla or api.ashbyhq.com/posting-api/job-board/salla
    const ashbyMatch = html.match(/jobs\.ashbyhq\.com\/([a-zA-Z0-9_-]+)/i) ||
                        html.match(/api\.ashbyhq\.com\/posting-api\/job-board\/([a-zA-Z0-9_-]+)/i);
    if (ashbyMatch?.[1]) return { provider: 'ashby', slug: ashbyMatch[1].toLowerCase() };

    if (html.includes('ashby-job-board') || html.includes('ashby-embedded')) {
      const ashbyOrg = html.match(/ashby.*?(?:org|organization|board)["']?:\s*["']([a-zA-Z0-9_-]+)["']/i);
      return { provider: 'ashby', slug: ashbyOrg?.[1]?.toLowerCase() ?? this.extractSlugFallback(fallbackUrl) };
    }

    // 4. Workable patterns
    // e.g. apply.workable.com/tamara or workable-job-board
    const workableMatch = html.match(/apply\.workable\.com\/([a-zA-Z0-9_-]+)/i) ||
                           html.match(/([a-zA-Z0-9_-]+)\.workable\.com/i);
    if (workableMatch?.[1] && workableMatch[1] !== 'apply' && workableMatch[1] !== 'www') {
      return { provider: 'workable', slug: workableMatch[1].toLowerCase() };
    }

    if (html.includes('workable-job-board') || html.includes('whr-embed') || html.includes('workable-widget')) {
      const workableSlug = html.match(/data-workable-account=["']([a-zA-Z0-9_-]+)["']/i);
      return { provider: 'workable', slug: workableSlug?.[1]?.toLowerCase() ?? this.extractSlugFallback(fallbackUrl) };
    }

    // 5. SmartRecruiters
    const srMatch = html.match(/careers\.smartrecruiters\.com\/([a-zA-Z0-9_-]+)/i);
    if (srMatch?.[1]) return { provider: 'smartrecruiters', slug: srMatch[1].toLowerCase() };
    if (html.includes('smartrecruiters.com')) {
      return { provider: 'smartrecruiters', slug: this.extractSlugFallback(fallbackUrl) };
    }

    // 6. Recruitee
    const recruiteeMatch = html.match(/([a-zA-Z0-9_-]+)\.recruitee\.com/i);
    if (recruiteeMatch?.[1] && recruiteeMatch[1] !== 'www') {
      return { provider: 'recruitee', slug: recruiteeMatch[1].toLowerCase() };
    }

    // 7. Personio
    const personioMatch = html.match(/([a-zA-Z0-9_-]+)\.jobs\.personio\.(?:de|com)/i);
    if (personioMatch?.[1]) return { provider: 'personio', slug: personioMatch[1].toLowerCase() };
    if (html.includes('personio.de') || html.includes('personio.com')) {
      return { provider: 'personio', slug: this.extractSlugFallback(fallbackUrl) };
    }

    // 8. BambooHR
    const bambooMatch = html.match(/([a-zA-Z0-9_-]+)\.bamboohr\.com\/(?:careers|jobs)/i);
    if (bambooMatch?.[1]) return { provider: 'bamboohr', slug: bambooMatch[1].toLowerCase() };

    return null;
  }

  // ── SLUG VERIFICATION ──────────────────────────────────────────────────────

  /**
   * Tests whether the detected slug exists against the provider's public API.
   */
  async verifySlug(provider: AtsProvider, slug: string): Promise<boolean> {
    if (!slug) return false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      if (provider === 'greenhouse') {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timer);
        return res.ok;
      }

      if (provider === 'lever') {
        const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timer);
        return res.ok;
      }

      if (provider === 'ashby') {
        const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({}),
          signal: controller.signal,
        });
        clearTimeout(timer);
        return res.ok;
      }

      if (provider === 'workable') {
        const res = await fetch(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timer);
        return res.ok;
      }
    } catch {
      // Verification soft-fail
    }
    return false;
  }

  // ── SAFE HTTP FETCHER & ROBOTS.TXT ─────────────────────────────────────────

  /**
   * Respects robots.txt directives for the target host.
   */
  async isRobotsAllowed(targetUrl: string): Promise<boolean> {
    try {
      const parsed = new URL(targetUrl);
      const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(robotsUrl, { signal: controller.signal }).catch(() => null);
      clearTimeout(timer);

      if (!res || !res.ok) return true; // Standard practice: no robots.txt = allowed

      const text = await res.text();
      const lines = text.split(/\r?\n/);
      let inWildcardBlock = false;
      const targetPath = parsed.pathname || '/';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const [directive, ...valParts] = trimmed.split(':');
        const d = directive.trim().toLowerCase();
        const val = valParts.join(':').trim();

        if (d === 'user-agent') {
          inWildcardBlock = val === '*';
        } else if (inWildcardBlock && d === 'disallow') {
          if (val === '') continue;
          if (targetPath.startsWith(val)) return false;
        }
      }
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Safely fetches page HTML with 10s timeout and 2MB payload cap.
   */
  private async fetchPageHtml(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        this.logger.debug(`HTTP ${res.status} fetching ${url}`);
        return null;
      }

      // 2MB cap
      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > this.maxPayloadBytes) {
        this.logger.warn(`Page size exceeds 2MB limit: ${url}`);
        return null;
      }

      const text = await res.text();
      return text.slice(0, this.maxPayloadBytes);
    } catch (err: unknown) {
      this.logger.debug(`Error fetching ${url}: ${String(err)}`);
      return null;
    }
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  // ── CACHE HELPERS (7 DAYS) ────────────────────────────────────────────────

  private async getCached(url: string): Promise<AtsDetectionResult | null> {
    const key = `ats:detector:${url}`;
    if (this.redis) {
      try {
        const val = await this.redis.get(key);
        if (val) return JSON.parse(val) as AtsDetectionResult;
      } catch {
        // Fall back to memory
      }
    }

    const mem = this.inMemoryCache.get(key);
    if (mem && mem.expiresAt > Date.now()) {
      return mem.result;
    }
    return null;
  }

  private async setCached(url: string, result: AtsDetectionResult): Promise<void> {
    const key = `ats:detector:${url}`;
    const ttlSeconds = 7 * 24 * 60 * 60; // 7 days

    if (this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(result));
        return;
      } catch {
        // Fall back to memory
      }
    }

    this.inMemoryCache.set(key, {
      result,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private normalizeUrl(input: string): string | null {
    try {
      const trimmed = input.trim();
      const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const parsed = new URL(withProto);
      return parsed.toString();
    } catch {
      return null;
    }
  }

  private extractSlugFallback(url?: string): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const parts = parsed.hostname.split('.');
      if (parts.length >= 2) {
        return parts[parts.length - 2].toLowerCase();
      }
    } catch {
      // Ignored
    }
    return null;
  }
}
