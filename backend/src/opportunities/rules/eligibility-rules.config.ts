/**
 * Config-driven rules for Candidate Eligibility & Score Adjustments.
 * 
 * Candidate Profile:
 * - Pakistan-based backend/AI engineer, 4+ yrs exp
 * - Core stack: Node.js / NestJS / TypeScript, Python (FastAPI / AsyncIO), PostgreSQL, AWS,
 *   WebSockets / WebRTC, Voice AI (Whisper, Cartesia, Twilio Media Streams), LLM APIs
 * - Relocation/sponsorship needed for KSA/UAE, or remote work
 * - Mid-level (reject principal / director / 7+ yrs)
 */

export interface SoftFlagRule {
  id: string;
  badgeLabel: string;
  description: string;
}

export interface ScoreAdjustmentRule {
  id: string;
  label: string;
  points: number;
}

export interface EligibilityRulesConfig {
  /** Maximum required years before hard reject (default: 7) */
  maxYearsExperienceThreshold: number;

  /** Seniority keywords that trigger hard reject */
  seniorityRejectKeywords: string[];

  /** Residency & nationality patterns that trigger hard reject */
  residencyRejectPatterns: string[];

  /** Proximity rule for "must be based in <location>" unless relocation/sponsor nearby */
  mustBeBasedInLocations: string[];
  relocationExceptionKeywords: string[];
  proximityWordDistance: number;

  /** Primary stacks that trigger reject IF candidate stack is not mentioned */
  mismatchStacks: string[];

  /** Candidate allowed/primary stack keywords */
  candidateStackKeywords: string[];

  /** Soft flags (keep opportunity, show warning badges) */
  softFlagRules: {
    arabic: { patterns: string[] };
    contractWithoutVisa: { contractPatterns: string[]; visaPatterns: string[] };
    onsiteWithoutRelocation: { onsitePatterns: string[]; relocationPatterns: string[] };
  };

  /** Score boosts and penalties */
  boosts: {
    visaPoints: number;
    visaPatterns: string[];
    relocationPoints: number;
    relocationPatterns: string[];
    remotePoints: number;
    remotePatterns: string[];
    candidateKeywordPointsEach: number;
    candidateKeywordMaxPoints: number;
    recentPostedHoursThreshold: number;
    recentPostedPoints: number;
  };

  penalties: {
    oldPostedDaysThreshold: number;
    oldPostedPenaltyPoints: number;
    noStackKeywordsPenaltyPoints: number;
  };
}

export const DEFAULT_ELIGIBILITY_CONFIG: EligibilityRulesConfig = {
  maxYearsExperienceThreshold: 7,

  seniorityRejectKeywords: [
    '10+ years',
    '10+ yrs',
    '8+ years',
    '8+ yrs',
    '7+ years',
    '7+ yrs',
    'head of',
    'principal',
    'vp ',
    'vp,',
    'vice president',
    'director',
    'engineering manager',
    'lead engineer',
    'tech lead',
    'staff engineer',
  ],

  residencyRejectPatterns: [
    'uae resident',
    'residents only',
    'resident only',
    'transferable visa',
    'visa transfer only',
    'saudi national',
    'saudization',
    'emirati only',
    'must be in ksa',
    'local candidates only',
    'no visa sponsorship',
    'not able to sponsor',
    'cannot sponsor',
    'must have valid work permit',
    'valid work permit required',
    'already in the uae',
    'already in uae',
    'already in the ksa',
    'already in ksa',
  ],

  mustBeBasedInLocations: [
    'uae',
    'ksa',
    'dubai',
    'riyadh',
    'abu dhabi',
    'jeddah',
    'dammam',
    'khobar',
    'saudi arabia',
    'united arab emirates',
  ],

  relocationExceptionKeywords: [
    'relocation',
    'relocate',
    'sponsor',
    'sponsorship',
    'visa provided',
    'assistance',
    'willing to relocate',
  ],

  proximityWordDistance: 35,

  mismatchStacks: [
    'java',
    '.net',
    'dotnet',
    'c#',
    'php',
    'sap',
    'salesforce',
    'flutter',
    'android',
    'ios',
    'swift',
    'kotlin',
    'golang',
    'ruby',
    'c++',
  ],

  candidateStackKeywords: [
    'node',
    'nodejs',
    'node.js',
    'nest',
    'nestjs',
    'nest.js',
    'typescript',
    'ts',
    'python',
    'fastapi',
    'asyncio',
    'postgresql',
    'postgres',
    'aws',
    'websocket',
    'websockets',
    'webrtc',
    'whisper',
    'cartesia',
    'twilio',
    'llm',
    'ai agent',
    'ai agents',
  ],

  softFlagRules: {
    arabic: {
      patterns: [
        'arabic required',
        'fluent in arabic',
        'arabic speaker',
        'arabic language',
        'must speak arabic',
        'native arabic',
        'arabic is required',
        'arabic: fluent',
      ],
    },
    contractWithoutVisa: {
      contractPatterns: ['contract', 'freelance', 'contractor'],
      visaPatterns: ['visa', 'sponsorship', 'sponsor', 'relocation'],
    },
    onsiteWithoutRelocation: {
      onsitePatterns: ['onsite', 'on-site', 'in-office', 'in office'],
      relocationPatterns: ['relocation', 'relocate', 'visa', 'sponsor', 'sponsorship', 'remote'],
    },
  },

  boosts: {
    visaPoints: 10,
    visaPatterns: ['visa sponsorship', 'visa provided', 'work visa provided', 'visa support'],
    relocationPoints: 10,
    relocationPatterns: ['relocation', 'relocation package', 'relocation assistance', 'relocate to'],
    remotePoints: 5,
    remotePatterns: ['remote', 'work from anywhere', 'wfh', '100% remote', 'fully remote'],
    candidateKeywordPointsEach: 3,
    candidateKeywordMaxPoints: 15,
    recentPostedHoursThreshold: 48,
    recentPostedPoints: 5,
  },

  penalties: {
    oldPostedDaysThreshold: 14,
    oldPostedPenaltyPoints: -10,
    noStackKeywordsPenaltyPoints: -15,
  },
};
