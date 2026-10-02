import { Test, TestingModule } from '@nestjs/testing';
import { JobProcessorService } from './job-processor.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ExtractionService } from '../../opportunities/extraction.service.js';
import { ScoringService } from '../../opportunities/scoring.service.js';
import { ApplyPackService } from '../../opportunities/apply-pack.service.js';
import { TelegramService } from '../../telegram/telegram.service.js';

describe('JobProcessorService', () => {
  let service: JobProcessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobProcessorService,
        {
          provide: PrismaService,
          useValue: {
            opportunity: { upsert: vi.fn(), update: vi.fn() },
            opportunityRequirement: { findUnique: vi.fn(), create: vi.fn() },
            opportunityMatch: { upsert: vi.fn() },
            applyPack: { findUnique: vi.fn() },
          },
        },
        {
          provide: ExtractionService,
          useValue: { extractRequirements: vi.fn() },
        },
        {
          provide: ScoringService,
          useValue: { score: vi.fn() },
        },
        {
          provide: ApplyPackService,
          useValue: { buildPack: vi.fn() },
        },
        {
          provide: TelegramService,
          useValue: { sendOpportunityCard: vi.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    service = module.get<JobProcessorService>(JobProcessorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
