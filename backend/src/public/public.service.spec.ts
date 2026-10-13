import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { PublicService } from './public.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PublicService', () => {
  let service: PublicService;
  let prismaMock: any;
  let llmServiceMock: any;
  let configServiceMock: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prismaMock = {
      user: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(1),
        createMany: vi.fn(),
      },
      project: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      skill: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      company: {
        create: vi.fn(),
      },
      contact: {
        create: vi.fn(),
      },
      clientQuery: {
        create: vi.fn().mockResolvedValue({ id: 'query-1' }),
      },
    };

    llmServiceMock = {
      generateStructured: vi.fn().mockResolvedValue({
        reply: 'We use BullMQ and Redis for queue-based multi-step pipeline processing.',
        action: 'show_architecture',
        actionPayload: 'queues',
        toolName: 'query_architecture_spec',
        toolOutput: '⚡ [ARCH: BullMQ + Redis active]',
        citations: ['BullMQ', 'Redis'],
      }),
    };

    configServiceMock = {
      get: vi.fn((key: string) => {
        if (key === 'DEEPGRAM_API_KEY') return 'master-key-DO-NOT-LEAK';
        return null;
      }),
    };

    service = new PublicService(
      prismaMock as unknown as PrismaService,
      llmServiceMock as any,
      configServiceMock as any,
    );
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

  it('should return grounded response from askJarvis', async () => {
    const res = await service.askJarvis({
      message: 'Explain your BullMQ queue architecture',
    });
    expect(res.reply).toContain('BullMQ');
    expect(res.toolName).toBe('query_architecture_spec');
    expect(res.action).toBe('show_architecture');
  });

  describe('getVoiceToken', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('mints a short-lived token and never returns the master key', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'jwt-abc', expires_in: 60 }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await service.getVoiceToken();

      expect(res).toEqual({ token: 'jwt-abc', expiresIn: 60 });
      expect(JSON.stringify(res)).not.toContain('master-key-DO-NOT-LEAK');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.deepgram.com/v1/auth/grant');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Token master-key-DO-NOT-LEAK');
      expect(JSON.parse(init.body)).toEqual({ ttl_seconds: 60 });
    });

    it('throws 503 when the key is not configured', async () => {
      configServiceMock.get.mockReturnValue(undefined);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await expect(service.getVoiceToken()).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws 503 without leaking details when Deepgram rejects the grant', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
      );

      const err = await service.getVoiceToken().catch((e: Error) => e);
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect(String((err as Error).message)).not.toContain('master-key-DO-NOT-LEAK');
    });

    it('throws 503 on network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
      await expect(service.getVoiceToken()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('throws 503 when Deepgram returns no access_token in grant body', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
      );
      await expect(service.getVoiceToken()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

});
