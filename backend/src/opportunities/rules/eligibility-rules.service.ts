import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_ELIGIBILITY_CONFIG,
  EligibilityRulesConfig,
  ScoreAdjustmentRule,
} from './eligibility-rules.config.js';

export interface EligibilityEvaluationInput {
  title?: string | null;
  rawText: string;
  postedAt?: Date | string | null;
  yearsRequired?: number | null;
  skillsRequired?: string[];
}

export interface EligibilityEvaluationResult {
  isFilteredOut: boolean;
  filterReason: string | null;
  matchedRule: string | null;
  softFlags: string[];
  scoreAdjustments: ScoreAdjustmentRule[];
  netScoreDelta: number;
}

@Injectable()
export class EligibilityRulesService {
  private readonly logger = new Logger(EligibilityRulesService.name);
  private config: EligibilityRulesConfig = DEFAULT_ELIGIBILITY_CONFIG;

  constructor() {}

  /**
   * Set or override rules configuration at runtime (e.g. from user preferences or admin settings).
   */
  setConfig(customConfig: Partial<EligibilityRulesConfig>) {
    this.config = { ...this.config, ...customConfig };
  }

  getConfig(): EligibilityRulesConfig {
    return this.config;
  }

  /**
   * Evaluates eligibility and score adjustments for a given opportunity.
   */
  evaluate(input: EligibilityEvaluationInput): EligibilityEvaluationResult {
    const title = (input.title ?? '').trim().toLowerCase();
    const rawText = (input.rawText ?? '').toLowerCase();
    const combined = `${title}\n${rawText}`;

    // ── 1. HARD REJECT CHECKS ─────────────────────────────────────────────

    // A. Explicit Residency & Nationality Restrictions
    for (const pattern of this.config.residencyRejectPatterns) {
      if (combined.includes(pattern)) {
        const reason = `Residency requirement: '${pattern}' detected`;
        this.logger.warn(`[Eligibility Reject] ${reason}`);
        return {
          isFilteredOut: true,
          filterReason: reason,
          matchedRule: 'RESIDENCY_RESTRICTION',
          softFlags: [],
          scoreAdjustments: [],
          netScoreDelta: 0,
        };
      }
    }

    // B. "Must be based in <Location>" Proximity Check
    const proximityReject = this.checkMustBeBasedInProximity(combined);
    if (proximityReject) {
      this.logger.warn(`[Eligibility Reject] ${proximityReject}`);
      return {
        isFilteredOut: true,
        filterReason: proximityReject,
        matchedRule: 'MUST_BE_BASED_IN_WITHOUT_RELOCATION',
        softFlags: [],
        scoreAdjustments: [],
        netScoreDelta: 0,
      };
    }

    // C. Seniority Too High
    const seniorityReject = this.checkSeniorityReject(title, combined, input.yearsRequired);
    if (seniorityReject) {
      this.logger.warn(`[Eligibility Reject] ${seniorityReject}`);
      return {
        isFilteredOut: true,
        filterReason: seniorityReject,
        matchedRule: 'SENIORITY_TOO_HIGH',
        softFlags: [],
        scoreAdjustments: [],
        netScoreDelta: 0,
      };
    }

    // D. Stack Mismatch
    const stackReject = this.checkStackMismatch(title, combined, input.skillsRequired);
    if (stackReject) {
      this.logger.warn(`[Eligibility Reject] ${stackReject}`);
      return {
        isFilteredOut: true,
        filterReason: stackReject,
        matchedRule: 'STACK_MISMATCH',
        softFlags: [],
        scoreAdjustments: [],
        netScoreDelta: 0,
      };
    }

    // ── 2. SOFT WARNING FLAGS ─────────────────────────────────────────────
    const softFlags: string[] = [];

    // Arabic required / fluent
    if (this.config.softFlagRules.arabic.patterns.some((p) => combined.includes(p))) {
      softFlags.push('ARABIC_REQUIRED');
    }

    // Contract without visa info
    const hasContract = this.config.softFlagRules.contractWithoutVisa.contractPatterns.some((p) =>
      this.hasWord(combined, p),
    );
    const hasVisaInfo = this.config.softFlagRules.contractWithoutVisa.visaPatterns.some((p) =>
      combined.includes(p),
    );
    if (hasContract && !hasVisaInfo) {
      softFlags.push('CONTRACT_NO_VISA');
    }

    // Onsite with no relocation info
    const hasOnsite = this.config.softFlagRules.onsiteWithoutRelocation.onsitePatterns.some((p) =>
      this.hasWord(combined, p),
    );
    const hasRelocationInfo = this.config.softFlagRules.onsiteWithoutRelocation.relocationPatterns.some((p) =>
      combined.includes(p),
    );
    if (hasOnsite && !hasRelocationInfo) {
      softFlags.push('ONSITE_NO_RELOCATION');
    }

    // ── 3. SCORE BOOSTS & PENALTIES ───────────────────────────────────────
    const scoreAdjustments: ScoreAdjustmentRule[] = [];

    // Boost: Visa sponsorship
    if (this.config.boosts.visaPatterns.some((p) => combined.includes(p))) {
      scoreAdjustments.push({
        id: 'BOOST_VISA',
        label: 'Offers Visa Sponsorship',
        points: this.config.boosts.visaPoints,
      });
    }

    // Boost: Relocation
    if (this.config.boosts.relocationPatterns.some((p) => combined.includes(p))) {
      scoreAdjustments.push({
        id: 'BOOST_RELOCATION',
        label: 'Relocation Assistance Provided',
        points: this.config.boosts.relocationPoints,
      });
    }

    // Boost: Remote
    if (this.config.boosts.remotePatterns.some((p) => this.hasWord(combined, p))) {
      scoreAdjustments.push({
        id: 'BOOST_REMOTE',
        label: 'Remote / Work From Anywhere',
        points: this.config.boosts.remotePoints,
      });
    }

    // Boost: Candidate stack keywords
    const matchedKeywords = this.config.candidateStackKeywords.filter((kw) =>
      this.hasWord(combined, kw),
    );
    if (matchedKeywords.length > 0) {
      const points = Math.min(
        matchedKeywords.length * this.config.boosts.candidateKeywordPointsEach,
        this.config.boosts.candidateKeywordMaxPoints,
      );
      scoreAdjustments.push({
        id: 'BOOST_STACK_KEYWORDS',
        label: `Core Stack Fit (${matchedKeywords.slice(0, 4).join(', ')})`,
        points,
      });
    }

    // Boost / Penalty: Posting Date
    if (input.postedAt) {
      const postedDate = new Date(input.postedAt);
      if (!Number.isNaN(postedDate.getTime())) {
        const diffMs = Date.now() - postedDate.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffHours / 24;

        if (diffHours <= this.config.boosts.recentPostedHoursThreshold && diffHours >= 0) {
          scoreAdjustments.push({
            id: 'BOOST_RECENT_POSTING',
            label: 'Fresh Posting (< 48 hours)',
            points: this.config.boosts.recentPostedPoints,
          });
        } else if (diffDays > this.config.penalties.oldPostedDaysThreshold) {
          scoreAdjustments.push({
            id: 'PENALTY_OLD_POSTING',
            label: `Older Posting (> ${this.config.penalties.oldPostedDaysThreshold} days)`,
            points: this.config.penalties.oldPostedPenaltyPoints,
          });
        }
      }
    }

    // Penalty: No candidate stack keywords found
    if (matchedKeywords.length === 0) {
      scoreAdjustments.push({
        id: 'PENALTY_NO_STACK_KEYWORDS',
        label: 'No target backend/AI stack keywords found',
        points: this.config.penalties.noStackKeywordsPenaltyPoints,
      });
    }

    const netScoreDelta = scoreAdjustments.reduce((sum, adj) => sum + adj.points, 0);

    return {
      isFilteredOut: false,
      filterReason: null,
      matchedRule: null,
      softFlags,
      scoreAdjustments,
      netScoreDelta,
    };
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────

  /**
   * Checks if target word or phrase appears as a bounded word.
   */
  private hasWord(text: string, term: string): boolean {
    if (term.includes('.') || term.includes('#') || term.includes('+')) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(text);
    }
    return new RegExp(`\\b${term}\\b`, 'i').test(text);
  }

  /**
   * "must be based in <location>" without relocation/sponsor nearby.
   */
  private checkMustBeBasedInProximity(text: string): string | null {
    const baseRegex = /must be based in\s+([a-z\s]+?)(?:[.,;\n]|$)/gi;
    let match: RegExpExecArray | null;

    while ((match = baseRegex.exec(text)) !== null) {
      const locationFragment = match[1].trim().toLowerCase();
      const matchedLocation = this.config.mustBeBasedInLocations.find((loc) =>
        locationFragment.includes(loc),
      );

      if (matchedLocation) {
        // Check window of words around this match
        const startPos = Math.max(0, match.index - 200);
        const endPos = Math.min(text.length, match.index + match[0].length + 200);
        const windowText = text.slice(startPos, endPos);

        const hasRelocationException = this.config.relocationExceptionKeywords.some((exc) =>
          windowText.includes(exc),
        );

        if (!hasRelocationException) {
          return `Must be based in ${matchedLocation.toUpperCase()} without relocation or sponsorship`;
        }
      }
    }

    return null;
  }

  /**
   * Seniority check (explicit title keywords, years threshold, regex).
   */
  private checkSeniorityReject(
    title: string,
    combined: string,
    yearsRequired?: number | null,
  ): string | null {
    // 1. Title seniority keywords
    for (const kw of this.config.seniorityRejectKeywords) {
      if (title.includes(kw)) {
        return `Seniority role in title: '${kw}'`;
      }
    }

    // 2. High years mentioned in description or explicit requirement
    if (yearsRequired && yearsRequired >= this.config.maxYearsExperienceThreshold) {
      return `Requires ${yearsRequired}+ years of experience (threshold >= ${this.config.maxYearsExperienceThreshold})`;
    }

    for (const kw of ['10+ years', '10+ yrs', '8+ years', '8+ yrs', '7+ years', '7+ yrs']) {
      if (combined.includes(kw)) {
        return `Experience requirement exceeds limit: '${kw}'`;
      }
    }

    // Regex check for >= 7 years required
    const expRegex = /(\b(?:[7-9]|[1-9]\d)\+?\s*(?:years|yrs)\b(?:\s+of)?(?:\s+experience)?)/gi;
    const match = expRegex.exec(combined);
    if (match) {
      return `Experience requirement exceeds limit: '${match[0]}'`;
    }

    return null;
  }

  /**
   * Primary stack mismatch check:
   * Rejects if primary stack is e.g. Java/.NET/PHP/SAP/Salesforce/Flutter-only/Android-only
   * with NO Node/Python/TypeScript mention.
   */
  private checkStackMismatch(
    title: string,
    combined: string,
    skillsRequired?: string[],
  ): string | null {
    const hasCandidateStack = this.config.candidateStackKeywords.some((kw) =>
      this.hasWord(combined, kw),
    );

    if (hasCandidateStack) {
      return null;
    }

    // If title specifically targets a mismatched stack (e.g. "Senior Java Developer", "Flutter Engineer")
    for (const stack of this.config.mismatchStacks) {
      if (this.hasWord(title, stack)) {
        return `Target stack mismatch in title: '${stack}' with no Node/Python/TypeScript mention`;
      }
    }

    // If description mentions mismatched stack and skills required has it
    if (skillsRequired && skillsRequired.length > 0) {
      const mismatchedSkills = skillsRequired.filter((s) =>
        this.config.mismatchStacks.some((m) => s.toLowerCase().includes(m)),
      );
      if (mismatchedSkills.length > 0) {
        return `Stack mismatch: requires [${mismatchedSkills.join(', ')}] with zero candidate stack match`;
      }
    }

    const matchedMismatches = this.config.mismatchStacks.filter((stack) =>
      this.hasWord(combined, stack),
    );
    if (matchedMismatches.length > 0) {
      return `Stack mismatch: primary technology (${matchedMismatches.join(', ')}) without Node/Python/TypeScript match`;
    }

    return null;
  }
}
