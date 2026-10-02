import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service.js';
import { EmailService } from './email/email.service.js';
import { AtsService } from './ats/ats.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('SchedulerService', () => {
  let service: SchedulerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: EmailService,
          useValue: { syncAlerts: vi.fn() },
        },
        {
          provide: AtsService,
          useValue: { syncAtsPostings: vi.fn() },
        },
        {
          provide: PrismaService,
          useValue: { user: { findMany: vi.fn().mockResolvedValue([]) } },
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
