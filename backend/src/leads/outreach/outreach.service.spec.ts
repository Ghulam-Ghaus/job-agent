import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutreachService } from './outreach.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LlmService } from '../../llm/llm.service.js';

describe('OutreachService', () => {
  let service: OutreachService;

  const mockPrisma = {
    company: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    profile: {
      findUnique: vi.fn().mockResolvedValue({ fullName: 'Ghulam Ghaus' }),
    },
    skill: {
      findMany: vi.fn().mockResolvedValue([{ name: 'NestJS' }]),
    },
    outreachMessage: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    suppressionEntry: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  const mockLlm = {
    generateStructured: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutreachService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LlmService, useValue: mockLlm },
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue('http://localhost:3000') } },
      ],
    }).compile();

    service = module.get<OutreachService>(OutreachService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject sending when daily cap of 15 emails is reached', async () => {
    mockPrisma.outreachMessage.findFirst.mockResolvedValueOnce({
      id: 'msg-1',
      status: 'DRAFT',
      companyId: 'comp-1',
      company: { name: 'Acme', website: 'https://acme.com' },
      contact: { email: 'ceo@acme.com' },
    });

    // 15 already sent today
    mockPrisma.outreachMessage.count.mockResolvedValueOnce(15);

    await expect(service.approveAndSend('msg-1', 'user-1')).rejects.toThrow(HttpException);
  });

  it('should reject sending to suppressed domain', async () => {
    mockPrisma.outreachMessage.findFirst.mockResolvedValueOnce({
      id: 'msg-1',
      status: 'DRAFT',
      companyId: 'comp-1',
      company: { name: 'Competitor Co', website: 'https://competitor.com' },
      contact: { email: 'info@competitor.com' },
    });

    mockPrisma.outreachMessage.count.mockResolvedValueOnce(2);
    // Found in suppression list
    mockPrisma.suppressionEntry.findFirst.mockResolvedValueOnce({
      id: 'sup-1',
      domain: 'competitor.com',
    });

    await expect(service.approveAndSend('msg-1', 'user-1')).rejects.toThrow(HttpException);
  });
});
