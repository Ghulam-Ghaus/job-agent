import { Test, TestingModule } from '@nestjs/testing';
import { ConnectorsController } from './connectors.controller.js';
import { SchedulerService } from './scheduler.service.js';
import { EmailService } from './email/email.service.js';
import { AtsService } from './ats/ats.service.js';
import { AtsDetectorService } from './ats/ats-detector.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ConnectorsController', () => {
  let controller: ConnectorsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConnectorsController],
      providers: [
        {
          provide: SchedulerService,
          useValue: { syncAll: vi.fn() },
        },
        {
          provide: EmailService,
          useValue: { syncAlerts: vi.fn() },
        },
        {
          provide: AtsService,
          useValue: { syncAtsPostings: vi.fn() },
        },
        {
          provide: AtsDetectorService,
          useValue: { detect: vi.fn() },
        },
        {
          provide: PrismaService,
          useValue: { jobPreference: { findUnique: vi.fn(), upsert: vi.fn() } },
        },
      ],
    }).compile();

    controller = module.get<ConnectorsController>(ConnectorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
