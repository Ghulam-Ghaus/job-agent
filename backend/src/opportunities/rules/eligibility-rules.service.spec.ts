import { describe, it, expect, beforeEach } from 'vitest';
import { EligibilityRulesService } from './eligibility-rules.service.js';

describe('EligibilityRulesService (Feature 1)', () => {
  let service: EligibilityRulesService;

  beforeEach(() => {
    service = new EligibilityRulesService();
  });

  // ─── 1. Residency / Nationality Hard Rejections ────────────────────────────
  describe('Residency & Nationality Rejections', () => {
    it('1. Rejects job requiring "uae resident"', () => {
      const res = service.evaluate({
        title: 'Backend Engineer',
        rawText: 'Looking for a Node.js developer. Must be a UAE resident to apply.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('RESIDENCY_RESTRICTION');
      expect(res.filterReason).toContain('uae resident');
    });

    it('2. Rejects job specifying "residents only"', () => {
      const res = service.evaluate({
        title: 'NestJS Developer',
        rawText: 'Open to UAE residents only. We do not provide visas.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('RESIDENCY_RESTRICTION');
    });

    it('3. Rejects job requiring "transferable visa"', () => {
      const res = service.evaluate({
        title: 'Backend Engineer',
        rawText: 'Candidate must possess a transferable visa in Saudi Arabia.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('RESIDENCY_RESTRICTION');
    });

    it('4. Rejects job requiring "visa transfer only"', () => {
      const res = service.evaluate({
        title: 'Python Backend Engineer',
        rawText: 'Immediate joining. Visa transfer only, based in Riyadh.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('RESIDENCY_RESTRICTION');
    });

    it('5. Rejects job reserved for "saudi national"', () => {
      const res = service.evaluate({
        title: 'Software Engineer',
        rawText: 'This position is strictly for Saudi National applicants.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('RESIDENCY_RESTRICTION');
    });

    it('6. Rejects job marked with "saudization"', () => {
      const res = service.evaluate({
        title: 'AI Platform Engineer',
        rawText: 'Role allocated for Saudization quota. Node.js stack.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('RESIDENCY_RESTRICTION');
    });

    it('7. Rejects job specifying "emirati only"', () => {
      const res = service.evaluate({
        title: 'Cloud Engineer',
        rawText: 'Emirati only hiring campaign in Dubai.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('RESIDENCY_RESTRICTION');
    });

    it('8. Rejects job specifying "no visa sponsorship"', () => {
      const res = service.evaluate({
        title: 'Node.js Developer',
        rawText: 'We offer great perks, but no visa sponsorship is available.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('RESIDENCY_RESTRICTION');
    });

    it('9. Rejects job requiring "must have valid work permit"', () => {
      const res = service.evaluate({
        title: 'TypeScript Engineer',
        rawText: 'Applicants must have valid work permit in UAE prior to onboarding.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('RESIDENCY_RESTRICTION');
    });

    it('10. Rejects job stating candidate must be "already in the uae"', () => {
      const res = service.evaluate({
        title: 'Backend Developer',
        rawText: 'Targeting candidates who are already in the UAE for fast start.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('RESIDENCY_RESTRICTION');
    });

    it('11. Rejects "must be based in Dubai" when no relocation is mentioned', () => {
      const res = service.evaluate({
        title: 'Backend Engineer',
        rawText: 'Candidates must be based in Dubai to attend weekly planning meetings.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('MUST_BE_BASED_IN_WITHOUT_RELOCATION');
    });

    it('12. Passes "must be based in Riyadh" when relocation assistance is offered', () => {
      const res = service.evaluate({
        title: 'Senior Backend Engineer',
        rawText:
          'Candidates must be based in Riyadh. Full relocation assistance and visa sponsorship provided for international talent.',
      });
      expect(res.isFilteredOut).toBe(false);
      expect(res.scoreAdjustments.some((a) => a.id === 'BOOST_RELOCATION')).toBe(true);
      expect(res.scoreAdjustments.some((a) => a.id === 'BOOST_VISA')).toBe(true);
    });
  });

  // ─── 2. Seniority Rejections ───────────────────────────────────────────────
  describe('Seniority Rejections', () => {
    it('13. Rejects job with "10+ years" experience requirement', () => {
      const res = service.evaluate({
        title: 'Backend Lead',
        rawText: 'Requires 10+ years of building large-scale distributed systems.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('SENIORITY_TOO_HIGH');
    });

    it('14. Rejects job with "8+ yrs" experience requirement', () => {
      const res = service.evaluate({
        title: 'Staff Backend Engineer',
        rawText: 'Minimum 8+ yrs with Node.js and cloud infrastructure.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('SENIORITY_TOO_HIGH');
    });

    it('15. Rejects job with "Head of Engineering" title', () => {
      const res = service.evaluate({
        title: 'Head of Engineering - Core Platform',
        rawText: 'Lead our 30-person engineering organization.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('SENIORITY_TOO_HIGH');
    });

    it('16. Rejects job with "Principal Architect" title', () => {
      const res = service.evaluate({
        title: 'Principal Software Engineer',
        rawText: 'Set architectural direction across all business domains.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('SENIORITY_TOO_HIGH');
    });

    it('17. Rejects job with "Engineering Manager" title', () => {
      const res = service.evaluate({
        title: 'Engineering Manager - Payments',
        rawText: 'Manage team of 8 backend engineers.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('SENIORITY_TOO_HIGH');
    });

    it('18. Passes mid-level role with 4 years experience', () => {
      const res = service.evaluate({
        title: 'Backend Engineer',
        rawText: 'Looking for a mid-level engineer with 4 years of experience in Node.js and PostgreSQL.',
        yearsRequired: 4,
      });
      expect(res.isFilteredOut).toBe(false);
    });
  });

  // ─── 3. Stack Mismatch Rejections ──────────────────────────────────────────
  describe('Stack Mismatch Rejections', () => {
    it('19. Rejects pure Java role with no Node/Python/TS', () => {
      const res = service.evaluate({
        title: 'Senior Java Developer',
        rawText: 'Spring Boot, Hibernate, Oracle DB, Maven microservices.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('STACK_MISMATCH');
    });

    it('20. Rejects .NET / C# role with no candidate stack keywords', () => {
      const res = service.evaluate({
        title: '.NET Developer',
        rawText: 'C#, ASP.NET Core, Entity Framework, Azure DevOps.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('STACK_MISMATCH');
    });

    it('21. Rejects Flutter-only mobile role', () => {
      const res = service.evaluate({
        title: 'Flutter Mobile Engineer',
        rawText: 'Building cross-platform mobile apps using Flutter and Dart.',
      });
      expect(res.isFilteredOut).toBe(true);
      expect(res.matchedRule).toBe('STACK_MISMATCH');
    });

    it('22. Passes hybrid role mentioning Java AND Node.js / TypeScript', () => {
      const res = service.evaluate({
        title: 'Fullstack Platform Engineer',
        rawText: 'Migrating legacy Java backend into high-performance Node.js and TypeScript microservices.',
      });
      expect(res.isFilteredOut).toBe(false);
    });
  });

  // ─── 4. Soft Flags & Score Adjustments ─────────────────────────────────────
  describe('Soft Flags and Score Adjustments', () => {
    it('23. Soft-flags Arabic requirement without rejecting opportunity', () => {
      const res = service.evaluate({
        title: 'Backend Engineer (NestJS)',
        rawText: 'Building fintech APIs with NestJS and PostgreSQL. Arabic speaker preferred for client workshops.',
      });
      expect(res.isFilteredOut).toBe(false);
      expect(res.softFlags).toContain('ARABIC_REQUIRED');
    });

    it('24. Soft-flags contract role without visa info', () => {
      const res = service.evaluate({
        title: 'TypeScript Backend Contractor',
        rawText: '6-month contract role building WebSockets data streaming with Node.js.',
      });
      expect(res.isFilteredOut).toBe(false);
      expect(res.softFlags).toContain('CONTRACT_NO_VISA');
    });

    it('25. Soft-flags onsite role without relocation info', () => {
      const res = service.evaluate({
        title: 'Node.js Developer',
        rawText: 'Onsite position in Dubai building real-time NestJS microservices.',
      });
      expect(res.isFilteredOut).toBe(false);
      expect(res.softFlags).toContain('ONSITE_NO_RELOCATION');
    });

    it('26. Accurately calculates score boosts for perfect candidate fit', () => {
      const res = service.evaluate({
        title: 'Senior Backend / AI Engineer',
        rawText: `
          We are offering full visa sponsorship and a comprehensive relocation package to Dubai.
          Or 100% remote work from anywhere.
          Stack: Node.js, NestJS, TypeScript, Python, FastAPI, WebSockets, Voice AI with Whisper & Cartesia, LLM integrations.
        `,
        postedAt: new Date(), // fresh (< 48 hrs)
      });
      expect(res.isFilteredOut).toBe(false);
      expect(res.softFlags).toHaveLength(0);
      expect(res.scoreAdjustments.some((a) => a.id === 'BOOST_VISA')).toBe(true);
      expect(res.scoreAdjustments.some((a) => a.id === 'BOOST_RELOCATION')).toBe(true);
      expect(res.scoreAdjustments.some((a) => a.id === 'BOOST_REMOTE')).toBe(true);
      expect(res.scoreAdjustments.some((a) => a.id === 'BOOST_STACK_KEYWORDS')).toBe(true);
      expect(res.scoreAdjustments.some((a) => a.id === 'BOOST_RECENT_POSTING')).toBe(true);
      expect(res.netScoreDelta).toBeGreaterThanOrEqual(40);
    });

    it('27. Applies penalty for posting older than 14 days', () => {
      const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const res = service.evaluate({
        title: 'Backend Engineer (Node.js)',
        rawText: 'NestJS and PostgreSQL engineer for fintech platform.',
        postedAt: oldDate,
      });
      expect(res.isFilteredOut).toBe(false);
      expect(res.scoreAdjustments.some((a) => a.id === 'PENALTY_OLD_POSTING')).toBe(true);
      const penalty = res.scoreAdjustments.find((a) => a.id === 'PENALTY_OLD_POSTING');
      expect(penalty?.points).toBe(-10);
    });
  });
});
