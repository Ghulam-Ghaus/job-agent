import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from '../generated/prisma/enums.js';

describe('AdminService', () => {
  let service: AdminService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'u-1',
            email: 'admin@jobagent.local',
            role: Role.SUPER_ADMIN,
            isActive: true,
            slug: 'admin',
            twoFactorEnabled: false,
            createdAt: new Date(),
            profile: { fullName: 'Admin User', headline: 'System Architect' },
            _count: { opportunities: 12, applyPacks: 4, companies: 6 },
          },
        ]),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      llmCall: {
        count: vi.fn().mockResolvedValue(10),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { tokensIn: 5000, tokensOut: 2000, costUsd: 0.05 },
          _avg: { durationMs: 450 },
        }),
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
      },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      opportunity: {
        count: vi.fn().mockResolvedValue(10),
      },
      company: {
        count: vi.fn().mockResolvedValue(5),
      },
    };

    service = new AdminService(prismaMock as unknown as PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get users with stats', async () => {
    const users = await service.getUsers();
    expect(users).toHaveLength(1);
    expect(users[0].stats.opportunities).toBe(12);
    expect(users[0].fullName).toBe('Admin User');
  });

  it('should calculate LLM usage and metrics', async () => {
    const metrics = await service.getLlmMetrics();
    expect(metrics.summary.totalCalls).toBe(10);
    expect(metrics.summary.totalTokensIn).toBe(5000);
    expect(metrics.summary.totalCostUsd).toBe(0.05);
  });

  it('should get sources status', async () => {
    const sources = await service.getSourcesStatus();
    expect(sources.sources).toHaveLength(4);
    expect(sources.sources.some((s) => s.type === 'EMAIL')).toBe(true);
  });
});
