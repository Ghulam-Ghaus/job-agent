import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApprovalService } from '../opportunities/approval.service.js';

describe('TelegramService', () => {
  let service: TelegramService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'TELEGRAM_BOT_TOKEN' ? '' : null),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            profile: { findFirst: async () => null, findUnique: async () => null, upsert: async () => null },
            user: { findFirst: async () => null },
            applyPack: { count: async () => 0, findUnique: async () => null },
            opportunity: { count: async () => 0, findUnique: async () => null },
            notification: { create: async () => null },
          },
        },
        {
          provide: ApprovalService,
          useValue: {
            decide: async () => ({ id: 'rec-1', decision: 'approved' }),
          },
        },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('initializes in disabled mode when token is absent without throwing', async () => {
    await service.onModuleInit();
    expect(service).toBeDefined();
  });
});
