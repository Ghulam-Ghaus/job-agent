import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JobRequirementFields } from './extraction.service.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  technical: number;   // max 40
  experience: number;  // max 20
  location: number;    // max 15
  seniority: number;   // max 10
  salary: number;      // max 10
  visa: number;        // max 5
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
  ): Promise<MatchResult> {
    // ── Load user data ──────────────────────────────────────────────────────
    const [profile, skills, experiences, prefs, cvs] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.skill.findMany({ where: { userId } }),
      this.prisma.experience.findMany({ where: { userId } }),
      this.prisma.jobPreference.findUnique({ where: { userId } }),
      this.prisma.cv.findMany({ where: { userId }, select: { id: true, isDefault: true, tags: true, label: true } }),
    ]);

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
}
