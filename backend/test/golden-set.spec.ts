import { describe, it, expect, beforeEach } from 'vitest';
import { ScoringService } from '../src/opportunities/scoring.service.js';
import { JobRequirementFields } from '../src/opportunities/extraction.service.js';

interface GoldenJob {
  id: string;
  title: string;
  fields: JobRequirementFields;
  expectedBand: 'STRONG' | 'MODERATE' | 'POOR'; // STRONG: >= 80, MODERATE: 60–79, POOR: < 60
  expectedMinScore: number;
  expectedMaxScore: number;
}

describe('Golden Set Evaluation Suite (Sprint 1.8)', () => {
  let scoringService: ScoringService;
  let mockPrisma: any;

  beforeEach(() => {
    // Ground truth profile: Senior Backend / Full-Stack Engineer (6 years exp)
    mockPrisma = {
      profile: {
        findUnique: async () => ({
          userId: 'user-golden-1',
          country: 'Pakistan',
          visaStatus: 'Need visa sponsorship',
          relocationCountries: ['Saudi Arabia', 'UAE', 'United Arab Emirates', 'Qatar'],
        }),
      },
      skill: {
        findMany: async () => [
          { name: 'TypeScript' },
          { name: 'Node.js' },
          { name: 'NestJS' },
          { name: 'PostgreSQL' },
          { name: 'Redis' },
          { name: 'Docker' },
          { name: 'AWS' },
          { name: 'REST APIs' },
          { name: 'Microservices' },
          { name: 'React' },
          { name: 'Next.js' },
          { name: 'Prisma' },
          { name: 'BullMQ' },
        ],
      },
      experience: {
        findMany: async () => [
          {
            title: 'Senior Software Engineer',
            company: 'Tech Solutions',
            startDate: new Date(Date.now() - 3 * 365 * 24 * 3600 * 1000), // 3 years
            endDate: null,
            isCurrent: true,
          },
          {
            title: 'Software Engineer',
            company: 'Software Hub',
            startDate: new Date(Date.now() - 6 * 365 * 24 * 3600 * 1000), // 3 years earlier
            endDate: new Date(Date.now() - 3 * 365 * 24 * 3600 * 1000),
            isCurrent: false,
          },
        ],
      },
      jobPreference: {
        findUnique: async () => ({
          targetRoles: ['Backend Engineer', 'Full Stack Engineer', 'Software Engineer'],
          targetCountries: ['Saudi Arabia', 'UAE', 'Remote'],
          minSalaryUsd: 50000,
          remoteOk: true,
        }),
      },
      cv: {
        findMany: async () => [
          {
            id: 'cv-senior-backend',
            isDefault: true,
            label: 'Senior Backend Engineer CV',
            tags: ['Backend', 'NestJS', 'NodeJS'],
          },
        ],
      },
    };

    scoringService = new ScoringService(mockPrisma);
  });

  // 30 Hand-labeled real / representative job postings across Saudi Arabia, UAE, and Remote
  const goldenJobs: GoldenJob[] = [
    // ── Strong Matches (Target score >= 80) ───────────────────────────────────
    {
      id: 'job-1',
      title: 'Senior NestJS / TypeScript Backend Engineer - Riyadh, Saudi Arabia',
      fields: {
        title: 'Senior Backend Engineer',
        company: 'Fintech Saudi',
        skills: [{ name: 'NestJS', required: true }, { name: 'TypeScript', required: true }, { name: 'PostgreSQL', required: true }, { name: 'Redis', required: false }],
        yearsExp: 5,
        seniority: 'SENIOR',
        country: 'Saudi Arabia',
        remote: false,
        salaryMax: 75000,
        visaSponsorship: true,
      },
      expectedBand: 'STRONG',
      expectedMinScore: 80,
      expectedMaxScore: 100,
    },
    {
      id: 'job-2',
      title: 'Lead Full Stack Node.js / React Developer - Dubai, UAE',
      fields: {
        title: 'Lead Full Stack Developer',
        company: 'Careem Ecosystem',
        skills: [{ name: 'Node.js', required: true }, { name: 'React', required: true }, { name: 'TypeScript', required: true }, { name: 'Docker', required: false }, { name: 'AWS', required: true }],
        yearsExp: 6,
        seniority: 'LEAD',
        country: 'UAE',
        remote: false,
        salaryMax: 90000,
        visaSponsorship: true,
      },
      expectedBand: 'STRONG',
      expectedMinScore: 80,
      expectedMaxScore: 100,
    },
    {
      id: 'job-3',
      title: 'Remote Backend Engineer (Node/NestJS/BullMQ) - Global Remote',
      fields: {
        title: 'Remote Backend Engineer',
        company: 'Cloud Scale Inc.',
        skills: [{ name: 'NestJS', required: true }, { name: 'Node.js', required: true }, { name: 'BullMQ', required: true }, { name: 'Redis', required: true }],
        yearsExp: 5,
        seniority: 'SENIOR',
        country: 'Remote',
        remote: true,
        salaryMax: 80000,
        visaSponsorship: undefined,
      },
      expectedBand: 'STRONG',
      expectedMinScore: 80,
      expectedMaxScore: 100,
    },
    {
      id: 'job-4',
      title: 'Staff / Senior Backend Specialist (Postgres/Redis/Node) - Abu Dhabi',
      fields: {
        title: 'Senior Backend Specialist',
        company: 'Hub71 Ventures',
        skills: [{ name: 'Node.js', required: true }, { name: 'PostgreSQL', required: true }, { name: 'Microservices', required: true }, { name: 'Docker', required: true }],
        yearsExp: 5,
        seniority: 'SENIOR',
        country: 'UAE',
        remote: false,
        salaryMax: 85000,
        visaSponsorship: true,
      },
      expectedBand: 'STRONG',
      expectedMinScore: 80,
      expectedMaxScore: 100,
    },
    {
      id: 'job-5',
      title: 'Full Stack Engineer (Next.js + NestJS) - Jeddah, Saudi Arabia',
      fields: {
        title: 'Full Stack Engineer',
        company: 'Saudi eCommerce',
        skills: [{ name: 'Next.js', required: true }, { name: 'NestJS', required: true }, { name: 'TypeScript', required: true }, { name: 'Prisma', required: false }],
        yearsExp: 4,
        seniority: 'MID',
        country: 'Saudi Arabia',
        remote: false,
        salaryMax: 65000,
        visaSponsorship: true,
      },
      expectedBand: 'STRONG',
      expectedMinScore: 80,
      expectedMaxScore: 100,
    },
    {
      id: 'job-6',
      title: 'Senior Cloud API Engineer (NodeJS/AWS/Docker) - Remote EMEA',
      fields: {
        title: 'Senior Cloud API Engineer',
        company: 'EMEA Remote Co',
        skills: [{ name: 'Node.js', required: true }, { name: 'AWS', required: true }, { name: 'Docker', required: true }, { name: 'REST APIs', required: true }],
        yearsExp: 5,
        seniority: 'SENIOR',
        country: 'Remote',
        remote: true,
        salaryMax: 70000,
        visaSponsorship: undefined,
      },
      expectedBand: 'STRONG',
      expectedMinScore: 80,
      expectedMaxScore: 100,
    },
    {
      id: 'job-7',
      title: 'Senior Backend Developer (TypeScript / Microservices) - Riyadh',
      fields: {
        title: 'Senior Backend Developer',
        company: 'STC Innovation Lab',
        skills: [{ name: 'TypeScript', required: true }, { name: 'NestJS', required: true }, { name: 'Microservices', required: true }, { name: 'PostgreSQL', required: true }],
        yearsExp: 6,
        seniority: 'SENIOR',
        country: 'Saudi Arabia',
        remote: false,
        salaryMax: 95000,
        visaSponsorship: true,
      },
      expectedBand: 'STRONG',
      expectedMinScore: 80,
      expectedMaxScore: 100,
    },
    {
      id: 'job-8',
      title: 'Full Stack TypeScript Engineer (React/Node) - Dubai Internet City',
      fields: {
        title: 'Full Stack TypeScript Engineer',
        company: 'Dubai Internet City Tech',
        skills: [{ name: 'TypeScript', required: true }, { name: 'React', required: true }, { name: 'Node.js', required: true }, { name: 'Docker', required: false }],
        yearsExp: 5,
        seniority: 'SENIOR',
        country: 'UAE',
        remote: false,
        salaryMax: 72000,
        visaSponsorship: true,
      },
      expectedBand: 'STRONG',
      expectedMinScore: 80,
      expectedMaxScore: 100,
    },
    {
      id: 'job-9',
      title: 'Backend Systems Engineer (Redis/Postgres/BullMQ) - Remote Gulf',
      fields: {
        title: 'Backend Systems Engineer',
        company: 'Logistics Gulf',
        skills: [{ name: 'BullMQ', required: true }, { name: 'Redis', required: true }, { name: 'Node.js', required: true }, { name: 'PostgreSQL', required: true }],
        yearsExp: 4,
        seniority: 'MID',
        country: 'Saudi Arabia',
        remote: true,
        salaryMax: 60000,
        visaSponsorship: undefined,
      },
      expectedBand: 'STRONG',
      expectedMinScore: 80,
      expectedMaxScore: 100,
    },
    {
      id: 'job-10',
      title: 'Senior TypeScript / Prisma Architect - Doha / Remote GCC',
      fields: {
        title: 'Senior TypeScript Architect',
        company: 'GCC Solutions',
        skills: [{ name: 'TypeScript', required: true }, { name: 'Prisma', required: true }, { name: 'NestJS', required: true }, { name: 'AWS', required: true }],
        yearsExp: 6,
        seniority: 'SENIOR',
        country: 'Qatar',
        remote: true,
        salaryMax: 84000,
        visaSponsorship: true,
      },
      expectedBand: 'STRONG',
      expectedMinScore: 80,
      expectedMaxScore: 100,
    },

    // ── Moderate Matches (Target score 60–79) ─────────────────────────────────
    {
      id: 'job-11',
      title: 'Backend Python / Django Developer - Riyadh (Tech Partial)',
      fields: {
        title: 'Backend Python Developer',
        company: 'Riyadh AI Inc',
        skills: [{ name: 'Python', required: true }, { name: 'Django', required: true }, { name: 'PostgreSQL', required: true }, { name: 'Docker', required: false }],
        yearsExp: 5,
        seniority: 'SENIOR',
        country: 'Saudi Arabia',
        remote: false,
        salaryMax: 70000,
        visaSponsorship: true,
      },
      expectedBand: 'MODERATE',
      expectedMinScore: 55,
      expectedMaxScore: 79,
    },
    {
      id: 'job-12',
      title: 'Principal Software Architect (12+ years required) - Dubai',
      fields: {
        title: 'Principal Software Architect',
        company: 'Emirates NBD',
        skills: [{ name: 'Node.js', required: true }, { name: 'AWS', required: true }, { name: 'Microservices', required: true }],
        yearsExp: 12,
        seniority: 'PRINCIPAL',
        country: 'UAE',
        remote: false,
        salaryMax: 120000,
        visaSponsorship: true,
      },
      expectedBand: 'MODERATE',
      expectedMinScore: 55,
      expectedMaxScore: 79,
    },
    {
      id: 'job-13',
      title: 'Frontend Vue.js / Nuxt Specialist - Remote',
      fields: {
        title: 'Frontend Vue Specialist',
        company: 'SaaS Worldwide',
        skills: [{ name: 'Vue.js', required: true }, { name: 'Nuxt', required: true }, { name: 'TypeScript', required: true }],
        yearsExp: 4,
        seniority: 'MID',
        country: 'Remote',
        remote: true,
        salaryMax: 65000,
        visaSponsorship: undefined,
      },
      expectedBand: 'MODERATE',
      expectedMinScore: 55,
      expectedMaxScore: 79,
    },
    {
      id: 'job-14',
      title: 'Full Stack Golang / React Developer - Abu Dhabi',
      fields: {
        title: 'Full Stack Golang Developer',
        company: 'ADGM FinTech',
        skills: [{ name: 'Go', required: true }, { name: 'React', required: true }, { name: 'Docker', required: true }],
        yearsExp: 5,
        seniority: 'SENIOR',
        country: 'UAE',
        remote: false,
        salaryMax: 75000,
        visaSponsorship: true,
      },
      expectedBand: 'MODERATE',
      expectedMinScore: 55,
      expectedMaxScore: 79,
    },
    {
      id: 'job-15',
      title: 'Mid Backend Node Developer (Budget below target) - Riyadh',
      fields: {
        title: 'Mid Backend Developer',
        company: 'SME Riyadh',
        skills: [{ name: 'Node.js', required: true }, { name: 'NestJS', required: true }, { name: 'PostgreSQL', required: true }],
        yearsExp: 3,
        seniority: 'MID',
        country: 'Saudi Arabia',
        remote: false,
        salaryMax: 32000, // Below 50k
        visaSponsorship: true,
      },
      expectedBand: 'MODERATE',
      expectedMinScore: 60,
      expectedMaxScore: 79,
    },
    {
      id: 'job-16',
      title: 'DevOps / Site Reliability Engineer - Dubai',
      fields: {
        title: 'DevOps Engineer',
        company: 'Cloud Dubai',
        skills: [{ name: 'Kubernetes', required: true }, { name: 'Terraform', required: true }, { name: 'AWS', required: true }, { name: 'Docker', required: true }],
        yearsExp: 5,
        seniority: 'SENIOR',
        country: 'UAE',
        remote: false,
        salaryMax: 80000,
        visaSponsorship: true,
      },
      expectedBand: 'MODERATE',
      expectedMinScore: 55,
      expectedMaxScore: 79,
    },
    {
      id: 'job-17',
      title: 'Backend Engineer - Singapore (No relocation pref)',
      fields: {
        title: 'Backend Engineer',
        company: 'Singapore Payments',
        skills: [{ name: 'Node.js', required: true }, { name: 'TypeScript', required: true }, { name: 'PostgreSQL', required: true }],
        yearsExp: 5,
        seniority: 'SENIOR',
        country: 'Singapore',
        remote: false,
        salaryMax: 80000,
        visaSponsorship: true,
      },
      expectedBand: 'MODERATE',
      expectedMinScore: 60,
      expectedMaxScore: 79,
    },
    {
      id: 'job-18',
      title: 'QA Automation Engineer (Cypress / Playwright) - Remote',
      fields: {
        title: 'QA Automation Engineer',
        company: 'Testing Corp',
        skills: [{ name: 'TypeScript', required: true }, { name: 'Cypress', required: true }, { name: 'Playwright', required: true }],
        yearsExp: 4,
        seniority: 'MID',
        country: 'Remote',
        remote: true,
        salaryMax: 55000,
        visaSponsorship: undefined,
      },
      expectedBand: 'MODERATE',
      expectedMinScore: 55,
      expectedMaxScore: 79,
    },
    {
      id: 'job-19',
      title: 'Backend Engineer - UAE (No Visa Sponsorship)',
      fields: {
        title: 'Backend Engineer',
        company: 'Local UAE Agency',
        skills: [{ name: 'Node.js', required: true }, { name: 'TypeScript', required: true }, { name: 'NestJS', required: true }],
        yearsExp: 4,
        seniority: 'MID',
        country: 'UAE',
        remote: false,
        salaryMax: 65000,
        visaSponsorship: false, // User needs visa!
      },
      expectedBand: 'MODERATE',
      expectedMinScore: 60,
      expectedMaxScore: 79,
    },
    {
      id: 'job-20',
      title: 'Mobile Engineer (React Native / iOS) - Riyadh',
      fields: {
        title: 'Mobile Developer',
        company: 'App Studio',
        skills: [{ name: 'React Native', required: true }, { name: 'React', required: true }, { name: 'TypeScript', required: true }],
        yearsExp: 4,
        seniority: 'MID',
        country: 'Saudi Arabia',
        remote: false,
        salaryMax: 60000,
        visaSponsorship: true,
      },
      expectedBand: 'MODERATE',
      expectedMinScore: 55,
      expectedMaxScore: 79,
    },

    // ── Poor Matches (Target score < 60) ──────────────────────────────────────
    {
      id: 'job-21',
      title: 'Legacy C# / .NET Desktop Developer - Frankfurt, Germany',
      fields: {
        title: '.NET Desktop Developer',
        company: 'Old Bank AG',
        skills: [{ name: 'C#', required: true }, { name: '.NET', required: true }, { name: 'WPF', required: true }],
        yearsExp: 8,
        seniority: 'SENIOR',
        country: 'Germany',
        remote: false,
        salaryMax: 60000,
        visaSponsorship: false,
      },
      expectedBand: 'POOR',
      expectedMinScore: 0,
      expectedMaxScore: 55,
    },
    {
      id: 'job-22',
      title: 'Junior PHP / WordPress Webmaster - Onsite Karachi',
      fields: {
        title: 'Junior WordPress Webmaster',
        company: 'Local Print Media',
        skills: [{ name: 'PHP', required: true }, { name: 'WordPress', required: true }, { name: 'jQuery', required: true }],
        yearsExp: 1,
        seniority: 'JUNIOR',
        country: 'Pakistan',
        remote: false,
        salaryMax: 8000, // Deeply below target
        visaSponsorship: false,
      },
      expectedBand: 'POOR',
      expectedMinScore: 0,
      expectedMaxScore: 55,
    },
    {
      id: 'job-23',
      title: 'Data Scientist (PyTorch / Computer Vision) - Tokyo, Japan',
      fields: {
        title: 'Computer Vision Scientist',
        company: 'Robotics Tokyo',
        skills: [{ name: 'PyTorch', required: true }, { name: 'OpenCV', required: true }, { name: 'CUDA', required: true }],
        yearsExp: 7,
        seniority: 'SENIOR',
        country: 'Japan',
        remote: false,
        salaryMax: 90000,
        visaSponsorship: false,
      },
      expectedBand: 'POOR',
      expectedMinScore: 0,
      expectedMaxScore: 55,
    },
    {
      id: 'job-24',
      title: 'Embedded Firmware Engineer (C / Assembly) - Austin, USA',
      fields: {
        title: 'Embedded Firmware Engineer',
        company: 'Chipset Corp',
        skills: [{ name: 'C', required: true }, { name: 'Assembly', required: true }, { name: 'RTOS', required: true }],
        yearsExp: 6,
        seniority: 'SENIOR',
        country: 'USA',
        remote: false,
        salaryMax: 110000,
        visaSponsorship: false,
      },
      expectedBand: 'POOR',
      expectedMinScore: 0,
      expectedMaxScore: 55,
    },
    {
      id: 'job-25',
      title: 'Salesforce Solutions Consultant - London, UK',
      fields: {
        title: 'Salesforce Consultant',
        company: 'Consulting UK',
        skills: [{ name: 'Apex', required: true }, { name: 'Salesforce', required: true }, { name: 'SOQL', required: true }],
        yearsExp: 5,
        seniority: 'SENIOR',
        country: 'UK',
        remote: false,
        salaryMax: 70000,
        visaSponsorship: false,
      },
      expectedBand: 'POOR',
      expectedMinScore: 0,
      expectedMaxScore: 55,
    },
    {
      id: 'job-26',
      title: 'Intern Front-End Developer - Paris, France',
      fields: {
        title: 'Frontend Intern',
        company: 'French Startup',
        skills: [{ name: 'HTML', required: true }, { name: 'CSS', required: true }, { name: 'Figma', required: true }],
        yearsExp: 0,
        seniority: 'JUNIOR',
        country: 'France',
        remote: false,
        salaryMax: 12000,
        visaSponsorship: false,
      },
      expectedBand: 'POOR',
      expectedMinScore: 0,
      expectedMaxScore: 55,
    },
    {
      id: 'job-27',
      title: 'Chief Information Security Officer (CISO) - Geneva',
      fields: {
        title: 'CISO',
        company: 'Private Bank',
        skills: [{ name: 'CISSP', required: true }, { name: 'SOC2', required: true }, { name: 'ISO27001', required: true }],
        yearsExp: 15,
        seniority: 'EXECUTIVE',
        country: 'Switzerland',
        remote: false,
        salaryMax: 200000,
        visaSponsorship: false,
      },
      expectedBand: 'POOR',
      expectedMinScore: 0,
      expectedMaxScore: 55,
    },
    {
      id: 'job-28',
      title: 'Ruby on Rails Senior Specialist - Onsite Sydney',
      fields: {
        title: 'Senior Rails Developer',
        company: 'Sydney Tech',
        skills: [{ name: 'Ruby', required: true }, { name: 'Rails', required: true }, { name: 'Sidekiq', required: true }],
        yearsExp: 8,
        seniority: 'SENIOR',
        country: 'Australia',
        remote: false,
        salaryMax: 95000,
        visaSponsorship: false,
      },
      expectedBand: 'POOR',
      expectedMinScore: 0,
      expectedMaxScore: 55,
    },
    {
      id: 'job-29',
      title: 'Cobol Mainframe Systems Programmer - Chicago',
      fields: {
        title: 'Cobol Programmer',
        company: 'Insurance Hub',
        skills: [{ name: 'COBOL', required: true }, { name: 'JCL', required: true }, { name: 'DB2', required: true }],
        yearsExp: 10,
        seniority: 'SENIOR',
        country: 'USA',
        remote: false,
        salaryMax: 85000,
        visaSponsorship: false,
      },
      expectedBand: 'POOR',
      expectedMinScore: 0,
      expectedMaxScore: 55,
    },
    {
      id: 'job-30',
      title: 'Hardware Circuit Design Engineer - Seoul, South Korea',
      fields: {
        title: 'Circuit Design Engineer',
        company: 'Hardware Electronics',
        skills: [{ name: 'Altium', required: true }, { name: 'VHDL', required: true }, { name: 'PCB', required: true }],
        yearsExp: 5,
        seniority: 'SENIOR',
        country: 'South Korea',
        remote: false,
        salaryMax: 60000,
        visaSponsorship: false,
      },
      expectedBand: 'POOR',
      expectedMinScore: 0,
      expectedMaxScore: 55,
    },
  ];

  it('evaluates all 30 golden jobs and satisfies >= 80% accuracy against ground truth bands', async () => {
    let correctCount = 0;
    const results: Array<{ id: string; title: string; score: number; band: string; expected: string; matched: boolean }> = [];

    for (const job of goldenJobs) {
      const result = await scoringService.score('user-golden-1', job.fields);
      let assignedBand: 'STRONG' | 'MODERATE' | 'POOR';
      if (result.score >= 80) {
        assignedBand = 'STRONG';
      } else if (result.score >= 60) {
        assignedBand = 'MODERATE';
      } else {
        assignedBand = 'POOR';
      }

      const matched = assignedBand === job.expectedBand;
      if (matched) correctCount++;

      results.push({
        id: job.id,
        title: job.title,
        score: result.score,
        band: assignedBand,
        expected: job.expectedBand,
        matched,
      });

      // Verify that recommended CV is always selected for strong/moderate matches
      if (assignedBand !== 'POOR') {
        expect(result.recommendedCvId).toBe('cv-senior-backend');
      }
    }

    const accuracy = (correctCount / goldenJobs.length) * 100;

    console.log(`Golden Set Accuracy: ${accuracy.toFixed(1)}% (${correctCount}/${goldenJobs.length})`);

    // Master requirement in docs/PLAN.md Sprint 1.8: Accuracy >= 80%
    expect(accuracy).toBeGreaterThanOrEqual(80);
  });
});
