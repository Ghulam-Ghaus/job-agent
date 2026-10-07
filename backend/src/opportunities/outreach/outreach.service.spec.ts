import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OutreachService } from './outreach.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LlmService } from '../../llm/llm.service.js';

describe('OutreachService (Feature 2)', () => {
  let service: OutreachService;
  let prismaMock: any;
  let llmMock: any;

  beforeEach(() => {
    prismaMock = {
      opportunity: {
        findFirst: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      profile: { findUnique: vi.fn() },
      skill: { findMany: vi.fn() },
      experience: { findMany: vi.fn() },
      project: { findMany: vi.fn() },
    };

    llmMock = {
      generateStructured: vi.fn(),
    };

    service = new OutreachService(prismaMock as PrismaService, llmMock as LlmService);
  });

  describe('Character Limit & Format Constraints', () => {
    it('1. Enforces strict length limits on all 5 generated messages', async () => {
      prismaMock.opportunity.findFirst.mockResolvedValue({
        id: 'opp-1',
        title: 'Backend Engineer',
        company: 'Maqsam',
        rawText: 'Looking for Node.js and NestJS engineer to work on voice contact center APIs.',
        match: { score: 85 },
        requirement: { fieldsJson: {} },
      });
      prismaMock.profile.findUnique.mockResolvedValue({
        fullName: 'Ghulam Ghaus',
        headline: 'Backend Engineer (4+ yrs)',
        country: 'Pakistan',
        visaStatus: 'Needs visa sponsorship',
      });
      prismaMock.skill.findMany.mockResolvedValue([
        { name: 'Node.js' },
        { name: 'NestJS' },
        { name: 'TypeScript' },
      ]);
      prismaMock.experience.findMany.mockResolvedValue([]);
      prismaMock.project.findMany.mockResolvedValue([
        { title: 'Voice AI Platform', techStack: ['NestJS', 'Whisper', 'Cartesia'] },
      ]);
      prismaMock.opportunity.update.mockResolvedValue({});

      // Mock LLM returning long texts
      llmMock.generateStructured.mockResolvedValue({
        recruiterDm: 'A'.repeat(500),
        connectionNote: 'B'.repeat(350),
        founderDm: 'C'.repeat(520),
        referralRequest: 'D'.repeat(490),
        followUpDm: 'E'.repeat(460),
        highlightedProfileItems: ['Voice AI Platform'],
      });

      const res = await service.generateOutreachPack('opp-1', 'user-1');

      expect(res.recruiterDm.length).toBeLessThanOrEqual(450);
      expect(res.connectionNote.length).toBeLessThanOrEqual(280);
      expect(res.founderDm!.length).toBeLessThanOrEqual(450);
      expect(res.referralRequest.length).toBeLessThanOrEqual(450);
      expect(res.followUpDm.length).toBeLessThanOrEqual(450);
    });

    it('2. Correctly builds LinkedIn search URLs for recruiters and engineering managers', async () => {
      prismaMock.opportunity.findFirst.mockResolvedValue({
        id: 'opp-2',
        title: 'Software Engineer',
        company: 'Careem Technologies',
        rawText: 'Join Careem engineering team.',
        match: { score: 90 },
      });
      prismaMock.profile.findUnique.mockResolvedValue({ fullName: 'Ghulam Ghaus' });
      prismaMock.skill.findMany.mockResolvedValue([]);
      prismaMock.experience.findMany.mockResolvedValue([]);
      prismaMock.project.findMany.mockResolvedValue([]);
      prismaMock.opportunity.update.mockResolvedValue({});

      const res = await service.generateOutreachPack('opp-2', 'user-1');

      expect(res.linkedInUrls.talentAcquisition).toBe(
        'https://www.linkedin.com/search/results/people/?keywords=Careem%20Technologies%20talent%20acquisition',
      );
      expect(res.linkedInUrls.engineeringManager).toBe(
        'https://www.linkedin.com/search/results/people/?keywords=Careem%20Technologies%20engineering%20manager',
      );
    });
  });

  describe('Unknown Technology Detector (Profile Fact Grounding)', () => {
    it('3. Flags unknown technologies mentioned in messages that are absent from profile', () => {
      const knownSkills = new Set(['node', 'nodejs', 'typescript', 'nestjs', 'postgresql']);
      const textWithHallucinations =
        'I am an expert in Rust and Solidity blockchain, with 4 years in Node.js and Kubernetes.';

      const flagged = service.detectUnknownTechnologies(textWithHallucinations, knownSkills);

      expect(flagged).toContain('rust');
      expect(flagged).toContain('solidity');
      expect(flagged).toContain('kubernetes');
      expect(flagged).not.toContain('node');
      expect(flagged).not.toContain('nodejs');
    });

    it('4. Flags zero unknown technologies when text only uses candidate stack', () => {
      const knownSkills = new Set(['node', 'nestjs', 'typescript', 'python', 'fastapi', 'postgresql', 'aws']);
      const cleanText =
        'I build scalable NestJS and FastAPI services on AWS with PostgreSQL and WebSockets.';

      const flagged = service.detectUnknownTechnologies(cleanText, knownSkills);

      expect(flagged).toHaveLength(0);
    });
  });

  describe('Startup Detection', () => {
    it('5. Detects startup by company size or early-stage indicators', () => {
      expect(service.detectStartup('We are an early-stage startup building fintech.', {})).toBe(true);
      expect(service.detectStartup('Series A funded AI startup.', {})).toBe(true);
      expect(service.detectStartup('Fast-paced environment with < 100 employees.', {})).toBe(true);
      expect(service.detectStartup('Company', { companySize: '11-50 employees' })).toBe(true);
      expect(service.detectStartup('stc is a leading telecom operator in KSA.', { companySize: '10000+' })).toBe(false);
    });
  });

  describe('Outreach Status & Follow-up Scheduling', () => {
    it('6. Scheduling follow-up 7 days in future when status is marked "sent"', async () => {
      prismaMock.opportunity.findFirst.mockResolvedValue({ id: 'opp-1', userId: 'user-1' });
      prismaMock.opportunity.update.mockImplementation(({ data }: any) => Promise.resolve(data));

      const updated = await service.updateOutreachStatus('opp-1', 'user-1', 'sent');

      expect(updated.outreachStatus).toBe('sent');
      expect(updated.outreachSentAt).toBeInstanceOf(Date);
      expect(updated.outreachFollowUpDue).toBeInstanceOf(Date);

      // Verify follow-up due is approx 7 days later
      const diffDays =
        (updated.outreachFollowUpDue!.getTime() - updated.outreachSentAt!.getTime()) /
        (1000 * 60 * 60 * 24);
      expect(Math.round(diffDays)).toBe(7);
    });

    it('7. Clears follow-up dates when status is reverted to "not_sent"', async () => {
      prismaMock.opportunity.findFirst.mockResolvedValue({ id: 'opp-1', userId: 'user-1' });
      prismaMock.opportunity.update.mockImplementation(({ data }: any) => Promise.resolve(data));

      const updated = await service.updateOutreachStatus('opp-1', 'user-1', 'not_sent');

      expect(updated.outreachStatus).toBe('not_sent');
      expect(updated.outreachSentAt).toBeNull();
      expect(updated.outreachFollowUpDue).toBeNull();
    });
  });
});
