import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AtsDetectorService } from './ats-detector.service.js';

describe('AtsDetectorService', () => {
  let service: AtsDetectorService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtsDetectorService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue(null), // Null Redis to test in-memory cache
          },
        },
      ],
    }).compile();

    service = module.get<AtsDetectorService>(AtsDetectorService);
  });

  describe('detectFromUrl (Direct URL Matching)', () => {
    it('detects Greenhouse boards and embeds', () => {
      expect(service.detectFromUrl('https://boards.greenhouse.io/careem')).toEqual({
        provider: 'greenhouse',
        slug: 'careem',
      });
      expect(service.detectFromUrl('https://boards.greenhouse.io/embed/job_board?for=noon')).toEqual({
        provider: 'greenhouse',
        slug: 'noon',
      });
    });

    it('detects Lever boards', () => {
      expect(service.detectFromUrl('https://jobs.lever.co/jahez')).toEqual({
        provider: 'lever',
        slug: 'jahez',
      });
    });

    it('detects Ashby boards', () => {
      expect(service.detectFromUrl('https://jobs.ashbyhq.com/salla')).toEqual({
        provider: 'ashby',
        slug: 'salla',
      });
    });

    it('detects Workable accounts', () => {
      expect(service.detectFromUrl('https://apply.workable.com/tamara')).toEqual({
        provider: 'workable',
        slug: 'tamara',
      });
      expect(service.detectFromUrl('https://tabby.workable.com')).toEqual({
        provider: 'workable',
        slug: 'tabby',
      });
    });

    it('detects SmartRecruiters, Recruitee, Personio, BambooHR', () => {
      expect(service.detectFromUrl('https://careers.smartrecruiters.com/AcmeCorp')).toEqual({
        provider: 'smartrecruiters',
        slug: 'acmecorp',
      });
      expect(service.detectFromUrl('https://foodics.recruitee.com')).toEqual({
        provider: 'recruitee',
        slug: 'foodics',
      });
      expect(service.detectFromUrl('https://mycompany.jobs.personio.de')).toEqual({
        provider: 'personio',
        slug: 'mycompany',
      });
      expect(service.detectFromUrl('https://unifonic.bamboohr.com/careers')).toEqual({
        provider: 'bamboohr',
        slug: 'unifonic',
      });
    });

    it('returns null for generic domain', () => {
      expect(service.detectFromUrl('https://google.com/careers')).toBeNull();
    });
  });

  describe('detectFromHtml (Embedded and Script Patterns)', () => {
    it('detects Greenhouse embed in custom careers page', () => {
      const html = `
        <html>
          <body>
            <div id="grnh_container">
              <iframe src="https://boards.greenhouse.io/embed/job_board?for=careemtech"></iframe>
            </div>
          </body>
        </html>
      `;
      expect(service.detectFromHtml(html)).toEqual({
        provider: 'greenhouse',
        slug: 'careemtech',
      });
    });

    it('detects Lever embed script and data attributes', () => {
      const html = `
        <html>
          <head>
            <script src="https://andreasmb.github.io/lever-jobs-embed/index.js"></script>
          </head>
          <body>
            <div id="lever-jobs" data-lever-site="hungerstation"></div>
          </body>
        </html>
      `;
      expect(service.detectFromHtml(html)).toEqual({
        provider: 'lever',
        slug: 'hungerstation',
      });
    });

    it('detects Ashby embed', () => {
      const html = `
        <html>
          <body>
            <script src="https://jobs.ashbyhq.com/salla/embed"></script>
          </body>
        </html>
      `;
      expect(service.detectFromHtml(html)).toEqual({
        provider: 'ashby',
        slug: 'salla',
      });
    });

    it('detects Workable widget embed', () => {
      const html = `
        <html>
          <body>
            <a href="https://apply.workable.com/zid-sa/">Join our team</a>
          </body>
        </html>
      `;
      expect(service.detectFromHtml(html)).toEqual({
        provider: 'workable',
        slug: 'zid-sa',
      });
    });
  });

  describe('detect (Full pipeline with robots, verification, and 7-day cache)', () => {
    it('detects Greenhouse board, verifies via API, and caches result for subsequent call', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/robots.txt')) {
          return { ok: true, status: 200, text: async () => 'User-agent: *\nAllow: /' };
        }
        if (url.includes('boards-api.greenhouse.io')) {
          return { ok: true, status: 200, json: async () => ({ name: 'Careem', jobs: [] }) };
        }
        // HTML page
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '1024' }),
          text: async () => '<html><body><a href="https://boards.greenhouse.io/careem">Jobs</a></body></html>',
        };
      });
      vi.stubGlobal('fetch', mockFetch);

      // First run: network fetch + verification
      const res1 = await service.detect('https://careem.com/careers');
      expect(res1.detected).toBe(true);
      expect(res1.provider).toBe('greenhouse');
      expect(res1.slug).toBe('careem');
      expect(res1.apiAvailable).toBe(true);
      expect(res1.verified).toBe(true);
      expect(res1.confidence).toBe(1.0);
      expect(res1.source).toBe('network');

      // Second run: cached in-memory (no network call)
      const res2 = await service.detect('https://careem.com/careers');
      expect(res2.detected).toBe(true);
      expect(res2.source).toBe('cache');
      expect(res2.slug).toBe('careem');

      vi.unstubAllGlobals();
    });

    it('respects robots.txt disallow and aborts fetch', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/robots.txt')) {
          return {
            ok: true,
            status: 200,
            text: async () => 'User-agent: *\nDisallow: /careers\nDisallow: /jobs',
          };
        }
        return { ok: true, status: 200, text: async () => '<html>Secret page</html>' };
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await service.detect('https://example.com/careers');
      expect(res.detected).toBe(false);

      vi.unstubAllGlobals();
    });
  });
});
