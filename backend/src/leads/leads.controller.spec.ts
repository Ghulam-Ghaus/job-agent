import { Test, TestingModule } from '@nestjs/testing';
import { LeadsController } from './leads.controller.js';
import { LeadsService } from './leads.service.js';
import { PlacesService } from '../connectors/places/places.service.js';
import { OutreachService } from './outreach/outreach.service.js';

describe('LeadsController', () => {
  let controller: LeadsController;

  const mockLeadsService = {
    discover: vi.fn().mockResolvedValue([]),
    importLead: vi.fn().mockResolvedValue({ id: 'comp-1' }),
    findAll: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue({ id: 'comp-1' }),
    update: vi.fn().mockResolvedValue({ id: 'comp-1' }),
    remove: vi.fn().mockResolvedValue({ id: 'comp-1' }),
    getSuppressions: vi.fn().mockResolvedValue([]),
    addSuppression: vi.fn().mockResolvedValue({ id: 'sup-1' }),
    removeSuppression: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const mockPlacesService = {
    getMonthlyUsage: vi.fn().mockResolvedValue({ callsThisMonth: 1, monthlyQuota: 500, estimatedCostUsd: 0.032 }),
  };

  const mockOutreachService = {
    draftOutreach: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    approveAndSend: vi.fn().mockResolvedValue({ id: 'msg-1', status: 'SENT' }),
    handleOptOut: vi.fn().mockResolvedValue({ domain: 'test.com' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        { provide: LeadsService, useValue: mockLeadsService },
        { provide: PlacesService, useValue: mockPlacesService },
        { provide: OutreachService, useValue: mockOutreachService },
      ],
    }).compile();

    controller = module.get<LeadsController>(LeadsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should discover leads', async () => {
    await controller.discover('user-1', { query: 'dental', locationBias: 'Riyadh' });
    expect(mockLeadsService.discover).toHaveBeenCalledWith('user-1', 'dental', 'Riyadh');
  });

  it('should approve and send outreach', async () => {
    const res = await controller.approveAndSend('user-1', 'msg-1');
    expect(mockOutreachService.approveAndSend).toHaveBeenCalledWith('msg-1', 'user-1');
    expect(res.status).toBe('SENT');
  });
});
