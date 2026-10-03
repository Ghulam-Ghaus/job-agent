import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JobRequirementFields } from './extraction.service.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  technical: number;   // max 40 (job) or 25 (freelance)
  experience: number;  // max 20 (job) or 10 (freelance)
  location: number;    // max 15
  seniority: number;   // max 10
  salary: number;      // max 10
  visa: number;        // max 5
  // Freelance specific dimensions
  budgetFit?: number;    // max 20
  clientTrust?: number;  // max 20
  competition?: number;  // max 15
  scopeClarity?: number; // max 10
}

export interface SkillGap {
  skill: string;
  required: boolean;
  reason: string;
}

export interface MatchResult {
  score: number; // 0–100
  breakdown: ScoreBreakdown;
  gaps: SkillGap[];
  recommendedCvId: string | null;
}

// ─── Scoring helpers ───────────────────────────────────────────────────────────

function clamp(value: number, max: number): number {
  return Math.min(Math.max(Math.round(value), 0), max);
}

function normaliseName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#]/g, '');
}

const SENIORITY_RANK: Record<string, number> = {
  JUNIOR: 1,
  MID: 2,
  SENIOR: 3,
  LEAD: 4,
  PRINCIPAL: 5,
  EXECUTIVE: 6,
};

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  async score(
    userId: string,
    fields: JobRequirementFields,
    opportunityType?: 'JOB' | 'FREELANCE' | 'LEAD',
  ): Promise<MatchResult> {
    // ── Load user data ──────────────────────────────────────────────────────
    const [profile, skills, experiences, prefs, cvs] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.skill.findMany({ where: { userId } }),
      this.prisma.experience.findMany({ where: { userId } }),
      this.prisma.jobPreference.findUnique({ where: { userId } }),
      this.prisma.cv.findMany({ where: { userId }, select: { id: true, isDefault: true, tags: true, label: true } }),
    ]);

    // Check if this is a freelance job per Sprint 3
    if (opportunityType === 'FREELANCE' || fields.isFreelance) {
      return this.scoreFreelance(userId, fields, skills, experiences, prefs, cvs);
    }

    const breakdown: ScoreBreakdown = {
      technical: 0,
      experience: 0,
      location: 0,
      seniority: 0,
      salary: 0,
      visa: 0,
    };
    const gaps: SkillGap[] = [];

    // ── 1. Technical skills (40 pts) ────────────────────────────────────────
    const userSkillNames = new Set(skills.map((s) => normaliseName(s.name)));
    const requiredSkills = fields.skills ?? [];

    if (requiredSkills.length > 0) {
      let matched = 0;
      let requiredTotal = 0;

      for (const reqSkill of requiredSkills) {
        const norm = normaliseName(reqSkill.name);
        if (reqSkill.required) requiredTotal++;

        if (userSkillNames.has(norm)) {
          matched++;
        } else {
          gaps.push({
            skill: reqSkill.name,
            required: reqSkill.required,
            reason: `Not found in your skill set`,
          });
        }
      }

      const matchRate =
        requiredTotal > 0 ? matched / requiredSkills.length : matched / requiredSkills.length;
      breakdown.technical = clamp(matchRate * 40, 40);
    } else {
      // No skills listed — neutral
      breakdown.technical = 20;
    }

    // ── 2. Experience years (20 pts) ────────────────────────────────────────
    const totalExpYears = experiences.reduce((acc, exp) => {
      const start = new Date(exp.startDate);
      const end = exp.isCurrent ? new Date() : exp.endDate ? new Date(exp.endDate) : new Date();
      const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
      return acc + Math.max(0, years);
    }, 0);

    const requiredYears = fields.yearsExp ?? 0;
    if (requiredYears === 0) {
      breakdown.experience = 15; // no requirement stated
    } else if (totalExpYears >= requiredYears) {
      breakdown.experience = 20;
    } else {
      const ratio = totalExpYears / requiredYears;
      breakdown.experience = clamp(ratio * 20, 20);
      if (ratio < 0.7) {
        gaps.push({
          skill: 'Years of experience',
          required: true,
          reason: `Job requires ${requiredYears}y, you have ${totalExpYears.toFixed(1)}y`,
        });
      }
    }

    // ── 3. Location / Remote (15 pts) ──────────────────────────────────────
    const jobCountry = (fields.country ?? '').toLowerCase();
    const userCountry = (profile?.country ?? '').toLowerCase();
    const userReloCountries = ((profile?.relocationCountries as string[]) ?? []).map((c) =>
      c.toLowerCase(),
    );
    const prefCountries = ((prefs?.targetCountries as string[]) ?? []).map((c) => c.toLowerCase());

    if (fields.remote) {
      breakdown.location = 15; // remote role
    } else if (jobCountry && userCountry && jobCountry === userCountry) {
      breakdown.location = 15;
    } else if (
      jobCountry &&
      (userReloCountries.includes(jobCountry) || prefCountries.includes(jobCountry))
    ) {
      breakdown.location = 10;
    } else if (jobCountry) {
      breakdown.location = 3;
      gaps.push({
        skill: 'Location',
        required: false,
        reason: `Job is in ${fields.country}, you may need to relocate`,
      });
    } else {
      breakdown.location = 8; // unknown location
    }

    // ── 4. Seniority (10 pts) ──────────────────────────────────────────────
    // Infer user seniority from experience years
    let userSeniorityRank = 1;
    if (totalExpYears >= 10) userSeniorityRank = 5;
    else if (totalExpYears >= 7) userSeniorityRank = 4;
    else if (totalExpYears >= 5) userSeniorityRank = 3;
    else if (totalExpYears >= 2) userSeniorityRank = 2;

    const jobSeniorityRank = SENIORITY_RANK[fields.seniority ?? ''] ?? 0;
    if (jobSeniorityRank === 0) {
      breakdown.seniority = 7; // no seniority stated
    } else {
      const diff = userSeniorityRank - jobSeniorityRank;
      if (diff >= 0) {
        breakdown.seniority = 10; // at or above required level
      } else if (diff === -1) {
        breakdown.seniority = 6; // one level below
        gaps.push({
          skill: 'Seniority',
          required: false,
          reason: `Job wants ${fields.seniority}, you appear to be ${Object.keys(SENIORITY_RANK).find((k) => SENIORITY_RANK[k] === userSeniorityRank)}`,
        });
      } else {
        breakdown.seniority = 2; // significantly below
        gaps.push({
          skill: 'Seniority',
          required: true,
          reason: `Job wants ${fields.seniority}, significant gap in level`,
        });
      }
    }

    // ── 5. Salary expectations (10 pts) ────────────────────────────────────
    const minSalaryPref = prefs?.minSalaryUsd ?? 0;
    const jobSalaryMax = fields.salaryMax ?? 0;
    if (!minSalaryPref || !jobSalaryMax) {
      breakdown.salary = 7; // unknown — neutral
    } else if (jobSalaryMax >= minSalaryPref) {
      breakdown.salary = 10;
    } else {
      const ratio = jobSalaryMax / minSalaryPref;
      breakdown.salary = clamp(ratio * 10, 10);
      if (ratio < 0.85) {
        gaps.push({
          skill: 'Salary',
          required: false,
          reason: `Job max $${jobSalaryMax.toLocaleString()} is below your min $${minSalaryPref.toLocaleString()}`,
        });
      }
    }

    // ── 6. Visa sponsorship (5 pts) ────────────────────────────────────────
    const needsVisa = profile?.visaStatus && profile.visaStatus.toLowerCase().includes('need');
    if (!needsVisa) {
      breakdown.visa = 5; // user doesn't need sponsorship — no risk
    } else if (fields.visaSponsorship === true) {
      breakdown.visa = 5;
    } else if (fields.visaSponsorship === false) {
      breakdown.visa = 0;
      gaps.push({
        skill: 'Visa sponsorship',
        required: true,
        reason: `Job doesn't offer visa sponsorship`,
      });
    } else {
      breakdown.visa = 3; // unknown
    }

    // ── Total ───────────────────────────────────────────────────────────────
    const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

    // ── Recommend CV ────────────────────────────────────────────────────────
    const defaultCv = cvs.find((c) => c.isDefault);
    const recommendedCvId = defaultCv?.id ?? cvs[0]?.id ?? null;

    this.logger.log(
      `Score for userId=${userId}: ${score}/100 (tech=${breakdown.technical}, exp=${breakdown.experience}, loc=${breakdown.location})`,
    );

    return { score, breakdown, gaps, recommendedCvId };
  }

  /**
   * Specialized multi-dimensional scoring for Freelance / Upwork opportunities (Sprint 3)
   * Evaluates:
   * 1. Technical skills (25 pts)
   * 2. Budget / Rate fit (20 pts)
   * 3. Client trust & history (20 pts)
   * 4. Competition / Proposals (15 pts)
   * 5. Scope clarity (10 pts)
   * 6. Experience & Track record (10 pts)
   */
  private scoreFreelance(
    userId: string,
    fields: JobRequirementFields,
    skills: Array<{ name: string }>,
    experiences: Array<{ startDate: string | Date; endDate?: string | Date | null; isCurrent?: boolean }>,
    _prefs: any,
    cvs: Array<{ id: string; isDefault: boolean; label?: string }>,
  ): MatchResult {
    const gaps: SkillGap[] = [];
    const breakdown: ScoreBreakdown = {
      technical: 0,
      experience: 0,
      location: 0,
      seniority: 0,
      salary: 0,
      visa: 0,
      budgetFit: 0,
      clientTrust: 0,
      competition: 0,
      scopeClarity: 0,
    };

    // 1. Technical Skills (25 pts)
    const userSkillNames = new Set(skills.map((s) => normaliseName(s.name)));
    const requiredSkills = fields.skills ?? [];
    if (requiredSkills.length > 0) {
      let matched = 0;
      for (const req of requiredSkills) {
        if (userSkillNames.has(normaliseName(req.name))) {
          matched++;
        } else {
          gaps.push({
            skill: req.name,
            required: req.required,
            reason: 'Missing from your freelance ATS skills',
          });
        }
      }
      breakdown.technical = clamp((matched / requiredSkills.length) * 25, 25);
    } else {
      breakdown.technical = 18; // general scope
    }

    // 2. Budget Fit (20 pts)
    const rateMax = fields.freelanceRateMax ?? fields.salaryMax ?? 0;
    const isHourly = fields.freelanceRateType === 'HOURLY' || fields.salaryPeriod === 'HOURLY';

    if (isHourly) {
      if (rateMax >= 60) breakdown.budgetFit = 20;
      else if (rateMax >= 40) breakdown.budgetFit = 17;
      else if (rateMax >= 25) breakdown.budgetFit = 13;
      else if (rateMax > 0) {
        breakdown.budgetFit = 6;
        gaps.push({ skill: 'Hourly Rate', required: false, reason: `Rate ($${rateMax}/hr) is below target` });
      } else {
        breakdown.budgetFit = 14; // unknown
      }
    } else {
      // Fixed price
      if (rateMax >= 2000) breakdown.budgetFit = 20;
      else if (rateMax >= 1000) breakdown.budgetFit = 17;
      else if (rateMax >= 400) breakdown.budgetFit = 13;
      else if (rateMax > 0) {
        breakdown.budgetFit = 6;
        gaps.push({ skill: 'Fixed Budget', required: false, reason: `Fixed budget ($${rateMax}) is low` });
      } else {
        breakdown.budgetFit = 14; // unknown
      }
    }
    breakdown.salary = breakdown.budgetFit;

    // 3. Client Trust & History (20 pts)
    let trustScore = 0;
    if (fields.clientPaymentVerified !== false) {
      trustScore += 10;
    } else {
      gaps.push({ skill: 'Client Verification', required: false, reason: 'Payment method is not verified' });
    }

    const rating = fields.clientRating ?? 5.0;
    if (rating >= 4.8) trustScore += 5;
    else if (rating >= 4.5) trustScore += 3;
    else if (rating < 4.0 && fields.clientRating) {
      gaps.push({ skill: 'Client Rating', required: false, reason: `Client rating is low (${rating}/5)` });
    }

    const spent = fields.clientTotalSpent ?? '';
    if (spent.includes('k+') || spent.includes('M+') || Number(spent.replace(/[^0-9]/g, '')) >= 5000) {
      trustScore += 5;
    } else if (spent) {
      trustScore += 2;
    } else {
      trustScore += 3;
    }
    breakdown.clientTrust = clamp(trustScore, 20);

    // 4. Competition / Proposals (15 pts)
    const proposals = (fields.proposalsCount ?? '').toLowerCase();
    if (proposals.includes('less than 5') || proposals.includes('< 5') || proposals.includes('<5')) {
      breakdown.competition = 15;
    } else if (proposals.includes('5 to 10') || proposals.includes('5-10')) {
      breakdown.competition = 12;
    } else if (proposals.includes('10 to 15') || proposals.includes('10-15')) {
      breakdown.competition = 8;
    } else if (proposals.includes('15 to 20') || proposals.includes('20 to 50')) {
      breakdown.competition = 4;
      gaps.push({ skill: 'High Competition', required: false, reason: `Already has ${fields.proposalsCount} proposals` });
    } else if (proposals.includes('50+') || proposals.includes('> 50')) {
      breakdown.competition = 1;
      gaps.push({ skill: 'High Competition', required: false, reason: 'Over 50 proposals submitted' });
    } else {
      breakdown.competition = 10; // unknown
    }

    // 5. Scope Clarity (10 pts)
    const descLen = (fields.description ?? '').length;
    if (fields.scopeClarity === 'CLEAR' || descLen >= 600) {
      breakdown.scopeClarity = 10;
    } else if (fields.scopeClarity === 'MODERATE' || descLen >= 250) {
      breakdown.scopeClarity = 7;
    } else {
      breakdown.scopeClarity = 4;
      gaps.push({ skill: 'Scope Ambiguity', required: false, reason: 'Project brief is short or lacks specific deliverables' });
    }

    // 6. Experience & Track Record (10 pts)
    const totalExpYears = experiences.reduce((acc, exp) => {
      const start = new Date(exp.startDate);
      const end = exp.isCurrent ? new Date() : exp.endDate ? new Date(exp.endDate) : new Date();
      return acc + Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365));
    }, 0);

    if (totalExpYears >= 4) breakdown.experience = 10;
    else if (totalExpYears >= 2) breakdown.experience = 7;
    else breakdown.experience = 4;

    // Total score
    const total =
      breakdown.technical +
      (breakdown.budgetFit ?? 0) +
      (breakdown.clientTrust ?? 0) +
      (breakdown.competition ?? 0) +
      (breakdown.scopeClarity ?? 0) +
      breakdown.experience;
    const score = clamp(total, 100);

    const defaultCv = cvs.find((c) => c.isDefault);
    const recommendedCvId = defaultCv?.id ?? cvs[0]?.id ?? null;

    this.logger.log(
      `Freelance Score for userId=${userId}: ${score}/100 (tech=${breakdown.technical}, budget=${breakdown.budgetFit}, trust=${breakdown.clientTrust}, comp=${breakdown.competition}, scope=${breakdown.scopeClarity})`,
    );

    return { score, breakdown, gaps, recommendedCvId };
  }
}
