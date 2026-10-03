import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublicService } from './public.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PublicService', () => {
  let service: PublicService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      user: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
        count: vi.fn().mockResolvedValue(1),
        createMany: vi.fn(),
      },
      company: {
        create: vi.fn(),
      },
      contact: {
        create: vi.fn(),
      },
    };

    service = new PublicService(prismaMock as unknown as PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return sanitized public profile without sensitive data', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'admin-1',
      slug: 'ghulam-ghaus',
      profile: {
        fullName: 'Ghulam Ghaus',
        headline: 'Lead Architect',
        summary: 'Expert in NestJS & Next.js',
        location: 'Riyadh, Saudi Arabia',
        country: 'Saudi Arabia',
        githubUrl: 'https://github.com/Ghulam-Ghaus',
        linkedinUrl: 'https://linkedin.com/in/ghulam-ghaus',
        portfolioUrl: 'https://ggitsols.com',
      },
      skills: [
        { name: 'NestJS', level: 'EXPERT', category: 'Backend', yearsOfExp: 6 },
      ],
      projects: [
        {
          id: 'proj-1',
          title: 'AI Job Agent',
          description: 'Autonomous job applier',
          techStack: ['NestJS', 'Next.js'],
          url: 'https://demo.app',
          repoUrl: null,
          highlights: ['95% match rate'],
          featured: true,
          isPublic: true,
        },
      ],
    });

    const res = await service.getPublicProfile('ghulam-ghaus');
    expect(res.name).toBe('Ghulam Ghaus');
    expect(res.slug).toBe('ghulam-ghaus');
    expect(res.skills).toHaveLength(1);
    expect(res.projects).toHaveLength(1);
    // Ensure sensitive fields are not present
    expect((res as any).passwordHash).toBeUndefined();
    expect((res as any).phone).toBeUndefined();
  });

  it('should return public products', async () => {
    prismaMock.product.findMany.mockResolvedValue([
      { id: 'prod-1', title: 'Agent Pipeline', priceUsd: 2500 },
    ]);

    const res = await service.getPublicProducts();
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('Agent Pipeline');
  });
});
