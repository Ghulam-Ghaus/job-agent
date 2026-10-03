import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TailoredCvService } from './tailored-cv.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LlmService } from '../llm/llm.service.js';
import { OpportunitiesService } from '../opportunities/opportunities.service.js';

describe('TailoredCvService', () => {
  let service: TailoredCvService;
  let prismaMock: any;
  let llmServiceMock: any;
  let opportunitiesServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      profile: {
        findUnique: vi.fn().mockResolvedValue({
          fullName: 'Ghulam Ghaus',
          headline: 'Senior Full Stack & AI Engineer',
          location: 'Lahore',
          country: 'Pakistan',
          phone: '+92300000000',
          linkedinUrl: 'https://linkedin.com/in/ghulamghaus',
          githubUrl: 'https://github.com/ghulamghaus',
        }),
      },
      skill: {
        findMany: vi.fn().mockResolvedValue([
          { name: 'TypeScript', level: 'EXPERT', category: 'Languages' },
          { name: 'NestJS', level: 'EXPERT', category: 'Backend' },
        ]),
        upsert: vi.fn().mockResolvedValue({
          id: 'sk-1',
          name: 'RESTful APIs',
          level: 'INTERMEDIATE',
          category: 'Backend',
        }),
      },
      experience: {
        findMany: vi.fn().mockResolvedValue([
          {
            title: 'Lead Software Architect',
            company: 'Tech Solutions',
            startDate: new Date('2022-01-01'),
            isCurrent: true,
            techStack: ['NestJS', 'PostgreSQL'],
            bullets: ['Architected microservices with 99.9% uptime.'],
          },
        ]),
      },
      project: {
        findMany: vi.fn().mockResolvedValue([
          {
            title: 'JobAgent AI',
            description: 'Autonomous job copilot',
            techStack: ['NestJS', 'Next.js'],
            highlights: ['Automated multi-channel matching.'],
          },
        ]),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ email: 'admin@jobagent.local' }),
      },
      opportunity: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'opp-1',
          title: 'Junior Backend Engineer',
          company: 'Dubai Holding',
          rawText: 'Looking for backend engineer with RESTful APIs',
          requirement: { fieldsJson: { title: 'Junior Backend Engineer' } },
        }),
      },
      tailoredCv: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tcv-1', ...data })),
        findMany: vi.fn().mockResolvedValue([]),
      },
      coverLetter: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 'cov-1', body: 'Dear Hiring Manager...' }),
      },
    };

    llmServiceMock = {
      generateStructured: vi.fn().mockResolvedValue({
        headline: 'Junior Backend Engineer',
        summary: 'Experienced software engineer focused on resilient backend systems.',
        skills: [{ category: 'Backend', items: ['NestJS', 'TypeScript'] }],
        experiences: [
          {
            title: 'Lead Software Architect',
            company: 'Tech Solutions',
            period: '2022 - Present',
            bullets: ['Architected microservices with 99.9% uptime.'],
            techStack: ['NestJS', 'PostgreSQL'],
          },
        ],
        projects: [
          {
            title: 'JobAgent AI',
            description: 'Autonomous job copilot',
            highlights: ['Automated multi-channel matching.'],
            techStack: ['NestJS', 'Next.js'],
          },
        ],
        status: 'passed',
        issues: [],
      }),
    };

    opportunitiesServiceMock = {
      reprocess: vi.fn().mockResolvedValue({ id: 'opp-1', match: { score: 88 } }),
    };

    service = new TailoredCvService(
      prismaMock as unknown as PrismaService,
      llmServiceMock as unknown as LlmService,
      opportunitiesServiceMock as unknown as OpportunitiesService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a tailored CV with LLM and verify facts', async () => {
    const res = await service.generateTailoredCv('user-1', {
      opportunityId: 'opp-1',
      targetRole: 'Junior Backend Engineer',
    });

    expect(res).toBeDefined();
    expect(res.targetRole).toBe('Junior Backend Engineer');
    expect(llmServiceMock.generateStructured).toHaveBeenCalledTimes(2); // Generation + Verification
  });

  it('should add skill from gap to profile and re-score opportunity', async () => {
    const res = await service.addSkillFromGap('user-1', {
      name: 'RESTful APIs',
      category: 'Backend',
      opportunityId: 'opp-1',
    });

    expect(res.success).toBe(true);
    expect(prismaMock.skill.upsert).toHaveBeenCalled();
    expect(opportunitiesServiceMock.reprocess).toHaveBeenCalledWith('opp-1', 'user-1');
  });

  it('should render an ATS-friendly PDF buffer', async () => {
    prismaMock.tailoredCv.findFirst = vi.fn().mockResolvedValue({
      id: 'tcv-1',
      targetRole: 'Junior Backend Engineer',
      contentJson: {
        headline: 'Junior Backend Engineer',
        summary: 'Targeted summary',
        skills: [{ category: 'Backend', items: ['TypeScript', 'NestJS'] }],
        experiences: [],
        projects: [],
      },
    });

    const pdf = await service.renderPdfBuffer('tcv-1', 'user-1');
    expect(pdf.buffer).toBeInstanceOf(Buffer);
    expect(pdf.buffer.length).toBeGreaterThan(500);
    expect(pdf.filename).toContain('.pdf');
  });
});
