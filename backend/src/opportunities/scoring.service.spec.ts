import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from './scoring.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ScoringService (Freelance & Job)', () => {
  let service: ScoringService;

  const mockPrisma = {
    profile: {
      findUnique: vi.fn().mockResolvedValue({
        country: 'Saudi Arabia',
        relocationCountries: ['UAE'],
        visaStatus: 'Citizen (no visa needed)',
      }),
    },
    skill: {
      findMany: vi.fn().mockResolvedValue([
        { name: 'NestJS', level: 'EXPERT' },
        { name: 'Next.js', level: 'EXPERT' },
        { name: 'TypeScript', level: 'EXPERT' },
        { name: 'PostgreSQL', level: 'INTERMEDIATE' },
      ]),
    },
    experience: {
      findMany: vi.fn().mockResolvedValue([
        {
          title: 'Senior Full Stack Engineer',
          company: 'Acme Corp',
          startDate: new Date('2021-01-01'),
          isCurrent: true,
        },
      ]),
    },
    jobPreference: {
      findUnique: vi.fn().mockResolvedValue({
        minSalaryUsd: 120000,
        targetCountries: ['Saudi Arabia', 'UAE'],
      }),
    },
    cv: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'cv-1', isDefault: true, label: 'Full Stack TS', tags: ['NestJS'] },
      ]),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ScoringService>(ScoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should score high for a prime Upwork freelance contract with verified client and low competition', async () => {
    const freelanceFields: any = {
      title: 'Full Stack Engineer (NestJS / Next.js)',
      isFreelance: true,
      skills: [
        { name: 'NestJS', required: true },
        { name: 'Next.js', required: true },
        { name: 'TypeScript', required: true },
      ],
      freelanceRateMax: 65,
      freelanceRateType: 'HOURLY',
      clientPaymentVerified: true,
      clientRating: 4.98,
      clientTotalSpent: '$80k+ spent',
      proposalsCount: 'Less than 5',
      scopeClarity: 'CLEAR',
      description: 'We need an experienced developer to build our automated scheduling microservice.',
    };

    const result = await service.score('user-1', freelanceFields, 'FREELANCE');

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.breakdown.technical).toBe(25); // all 3 skills matched
    expect(result.breakdown.budgetFit).toBe(20); // $65/hr is top tier
    expect(result.breakdown.clientTrust).toBe(20); // verified + 4.98 + $80k spent
    expect(result.breakdown.competition).toBe(15); // <5 proposals
    expect(result.breakdown.scopeClarity).toBe(10); // clear
    expect(result.recommendedCvId).toBe('cv-1');
  });

  it('should penalize unverified clients and intense competition in freelance jobs', async () => {
    const riskyFreelance: any = {
      title: 'Quick Bug Fix',
      isFreelance: true,
      skills: [{ name: 'NestJS', required: true }],
      freelanceRateMax: 15, // low rate
      freelanceRateType: 'HOURLY',
      clientPaymentVerified: false,
      clientRating: 3.5,
      clientTotalSpent: '$0',
      proposalsCount: '20 to 50',
      scopeClarity: 'VAGUE',
      description: 'Need help asap.',
    };

    const result = await service.score('user-1', riskyFreelance, 'FREELANCE');

    expect(result.score).toBeLessThan(65);
    expect(result.gaps.some((g) => g.skill === 'Client Verification')).toBe(true);
    expect(result.gaps.some((g) => g.skill === 'High Competition')).toBe(true);
    expect(result.gaps.some((g) => g.skill === 'Hourly Rate')).toBe(true);
  });
});
