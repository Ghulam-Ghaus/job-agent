import { Test, TestingModule } from '@nestjs/testing';
import { AtsService, matchesLocationFilters } from './ats.service.js';
import { PipelineService } from '../../queues/pipeline/pipeline.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('matchesLocationFilters', () => {
  it('matches everything when no filters are set', () => {
    expect(matchesLocationFilters('Berlin, Germany', [])).toBe(true);
  });

  it('expands country filters to cities', () => {
    expect(matchesLocationFilters('Riyadh', ['Saudi Arabia'])).toBe(true);
    expect(matchesLocationFilters('Dubai, United Arab Emirates', ['UAE'])).toBe(true);
    expect(matchesLocationFilters('Karachi, Pakistan', ['Saudi Arabia', 'UAE'])).toBe(false);
  });

  it('matches remote postings for the Remote filter', () => {
    expect(matchesLocationFilters('Remote - EMEA', ['Remote'])).toBe(true);
  });

  it('keeps postings with unknown location', () => {
    expect(matchesLocationFilters('Unknown', ['UAE'])).toBe(true);
  });

  it('does not match short aliases inside longer words', () => {
    expect(matchesLocationFilters('Bukhara', ['Europe'])).toBe(false);
  });
});

describe('AtsService', () => {
  let service: AtsService;
  const addJob = vi.fn();
  const prisma = {
    jobPreference: { findUnique: vi.fn() },
    opportunity: { findMany: vi.fn() },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtsService,
        { provide: PipelineService, useValue: { addJob } },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AtsService>(AtsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('reports new, duplicate and location-filtered postings separately', async () => {
    vi.useFakeTimers();
    prisma.jobPreference.findUnique.mockResolvedValue({
      atsTargets: [{ platform: 'lever', slug: 'acme' }],
      locationFilters: ['UAE'],
    });
    prisma.opportunity.findMany.mockResolvedValue([{ url: 'https://jobs/dup' }]);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: '1', text: 'A', hostedUrl: 'https://jobs/new', categories: { location: 'Dubai' }, descriptionPlain: 'x' },
          { id: '2', text: 'B', hostedUrl: 'https://jobs/dup', categories: { location: 'Dubai' }, descriptionPlain: 'x' },
          { id: '3', text: 'C', hostedUrl: 'https://jobs/far', categories: { location: 'Tokyo' }, descriptionPlain: 'x' },
        ],
      }),
    );

    const pending = service.syncAtsPostings('user-1');
    await vi.advanceTimersByTimeAsync(1500);
    const result = await pending;

    expect(result).toMatchObject({
      companiesChecked: 1,
      jobsFound: 3,
      jobsEnqueued: 1,
      duplicatesSkipped: 1,
      locationFiltered: 1,
    });
    expect(addJob).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
