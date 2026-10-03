import { Test, TestingModule } from '@nestjs/testing';
import { NeedAnalyzerService } from './need-analyzer.service.js';
import { LlmService } from '../../llm/llm.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('NeedAnalyzerService', () => {
  let service: NeedAnalyzerService;

  const mockLlm = {
    generateStructured: vi.fn().mockResolvedValue({
      qualificationScore: 82,
      summary: 'Dental clinic website lacks direct booking widget.',
      signals: [
        {
          signal: 'No direct booking',
          category: 'BOOKING_SYSTEM',
          evidence: 'Please call our reception during opening hours to book.',
          severity: 'HIGH',
          recommendation: 'Integrated real-time appointment scheduler',
        },
      ],
      suggestedAngle: 'Offer an automated booking workflow that captures evening patients.',
    }),
  };

  const mockPrisma = {
    profile: {
      findUnique: vi.fn().mockResolvedValue({ fullName: 'Ghulam Ghaus' }),
    },
    skill: {
      findMany: vi.fn().mockResolvedValue([{ name: 'Next.js' }, { name: 'NestJS' }]),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NeedAnalyzerService,
        { provide: LlmService, useValue: mockLlm },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NeedAnalyzerService>(NeedAnalyzerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should analyze website and return evidence-backed need signals', async () => {
    const result = await service.analyzeWebsite('https://example-clinic.com', 'Example Clinic', 'user-1');
    expect(result.qualificationScore).toBe(82);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].severity).toBe('HIGH');
    expect(mockLlm.generateStructured).toHaveBeenCalled();
  });
});
