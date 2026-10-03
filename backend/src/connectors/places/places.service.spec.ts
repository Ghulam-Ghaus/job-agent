import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PlacesService } from './places.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('PlacesService', () => {
  let service: PlacesService;

  const mockPrisma = {
    setting: {
      findUnique: vi.fn().mockResolvedValue({ value: { count: 5 } }),
      upsert: vi.fn(),
    },
    suppressionEntry: {
      findMany: vi.fn().mockResolvedValue([
        { domain: 'blockedcompetitor.com' },
      ]),
    },
  };

  const mockConfig = {
    get: vi.fn().mockReturnValue(''), // empty key triggers realistic curated mock
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacesService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlacesService>(PlacesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return qualified businesses and calculate usage cost', async () => {
    const usage = await service.getMonthlyUsage('user-1');
    expect(usage.callsThisMonth).toBe(5);
    expect(usage.monthlyQuota).toBe(500);
    expect(usage.estimatedCostUsd).toBe(0.16);

    const businesses = await service.searchBusinesses('user-1', 'dental', 'Riyadh');
    expect(businesses.length).toBeGreaterThan(0);
    expect(businesses[0].placeId).toBeDefined();
    expect(businesses[0].website).toBeDefined();
  });
});
