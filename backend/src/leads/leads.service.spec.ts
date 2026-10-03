import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlacesService } from '../connectors/places/places.service.js';
import { NeedAnalyzerService } from './need-analyzer/need-analyzer.service.js';
import { OutreachService } from './outreach/outreach.service.js';

describe('LeadsService', () => {
  let service: LeadsService;

  const mockPrisma = {
    company: {
      upsert: vi.fn().mockResolvedValue({ id: 'comp-1', name: 'Al-Noor Clinic' }),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
    },
    contact: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    suppressionEntry: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  const mockPlaces = {
    searchBusinesses: vi.fn().mockResolvedValue([
      { placeId: 'pl-1', name: 'Al-Noor Clinic', website: 'https://alnoor-test.com' },
    ]),
  };

  const mockNeedAnalyzer = {
    analyzeWebsite: vi.fn().mockResolvedValue({
      qualificationScore: 85,
      summary: 'Lacks automated booking',
      signals: [{ signal: 'No booking', severity: 'HIGH' }],
    }),
  };

  const mockOutreach = {
    draftOutreach: vi.fn().mockResolvedValue({ id: 'msg-1', subject: 'Automated booking solution' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlacesService, useValue: mockPlaces },
        { provide: NeedAnalyzerService, useValue: mockNeedAnalyzer },
        { provide: OutreachService, useValue: mockOutreach },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should discover leads via PlacesService', async () => {
    const results = await service.discover('user-1', 'dentist', 'Riyadh');
    expect(mockPlaces.searchBusinesses).toHaveBeenCalledWith('user-1', 'dentist', 'Riyadh');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Al-Noor Clinic');
  });

  it('should import business, analyze need signals, and auto-draft outreach if score >= 80', async () => {
    mockPrisma.company.update.mockResolvedValueOnce({
      id: 'comp-1',
      name: 'Al-Noor Clinic',
      qualificationScore: 85,
      status: 'QUALIFIED',
    });

    const res = await service.importLead('user-1', {
      placeId: 'pl-1',
      name: 'Al-Noor Clinic',
      website: 'https://alnoor-test.com',
    });

    expect(mockPrisma.company.upsert).toHaveBeenCalled();
    expect(mockNeedAnalyzer.analyzeWebsite).toHaveBeenCalledWith('https://alnoor-test.com', 'Al-Noor Clinic', 'user-1');
    expect(mockOutreach.draftOutreach).toHaveBeenCalledWith('comp-1', 'user-1');
    expect(res).toBeDefined();
  });
});
