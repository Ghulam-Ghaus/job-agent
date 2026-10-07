import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LlmService } from '../../llm/llm.service.js';

export interface OutreachPackResult {
  recruiterDm: string;
  connectionNote: string;
  founderDm: string | null;
  referralRequest: string;
  followUpDm: string;
  isStartup: boolean;
  linkedInUrls: {
    talentAcquisition: string;
    engineeringManager: string;
  };
  highlightedProfileItems: string[];
  unknownTechnologiesFlagged: string[];
  generatedAt: string;
}

const OutreachGeneratedSchema = z.object({
  recruiterDm: z.string().describe('Message for recruiter/hiring manager (max 450 chars). Mentions 1-2 profile items, states open to relocation / need sponsorship honestly.'),
  connectionNote: z.string().describe('Connection request note for LinkedIn (strictly max 280 chars). Concise, polite.'),
  founderDm: z.string().nullable().describe('Variant message for startup founder/CTO (max 450 chars). Emphasizes rapid execution, architecture, and reliability.'),
  referralRequest: z.string().describe('Referral request message for an existing engineer at company (max 450 chars). Polite, asks for advice or referral.'),
  followUpDm: z.string().describe('Follow-up message to send after 7 days (max 450 chars). Friendly, brief check-in.'),
  highlightedProfileItems: z.array(z.string()).describe('1-2 real profile projects or achievements highlighted in the messages.'),
});

/**
 * Common tech tokens to detect potential hallucinations of skills absent from profile
 */
const KNOWN_TECH_KEYWORDS = [
  'node', 'nodejs', 'node.js', 'nest', 'nestjs', 'typescript', 'ts', 'javascript', 'js',
  'python', 'fastapi', 'asyncio', 'postgresql', 'postgres', 'sql', 'aws', 'serverless',
  'lambda', 'websockets', 'websocket', 'webrtc', 'whisper', 'cartesia', 'twilio',
  'voice ai', 'llm', 'gemini', 'groq', 'redis', 'bullmq', 'docker', 'rest', 'restful',
  'microservices', 'prisma', 'react', 'nextjs', 'next.js',
];

@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  /**
   * Generates a tailored outreach pack for an opportunity, grounded strictly in candidate profile data.
   */
  async generateOutreachPack(
    opportunityId: string,
    userId: string,
    scoreThreshold?: number,
  ): Promise<OutreachPackResult> {
    const opp = await this.prisma.opportunity.findFirst({
      where: { id: opportunityId, userId },
      include: { requirement: true, match: true },
    });

    if (!opp) throw new NotFoundException(`Opportunity ${opportunityId} not found`);

    const effectiveThreshold = scoreThreshold ?? 70;
    const currentScore = opp.match?.score ?? 0;
    if (opp.match && currentScore < effectiveThreshold) {
      this.logger.warn(
        `Generating outreach pack for opp ${opportunityId} with score ${currentScore} (below threshold ${effectiveThreshold})`,
      );
    }

    const [profile, skills, experiences, projects] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.skill.findMany({ where: { userId } }),
      this.prisma.experience.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
      this.prisma.project.findMany({ where: { userId } }),
    ]);

    const companyName = opp.company?.trim() || 'the team';
    const jobTitle = opp.title?.trim() || 'Backend Engineer';
    const isStartup = this.detectStartup(opp.rawText, opp.requirement?.fieldsJson);

    // Build known candidate skills set for hallucination verification
    const knownSkills = new Set<string>();
    for (const kw of KNOWN_TECH_KEYWORDS) knownSkills.add(kw.toLowerCase());
    for (const s of skills) knownSkills.add(s.name.toLowerCase());
    for (const p of projects) {
      if (Array.isArray(p.techStack)) {
        for (const t of p.techStack) {
          if (typeof t === 'string') knownSkills.add(t.toLowerCase());
        }
      }
    }
    for (const e of experiences) {
      if (Array.isArray(e.techStack)) {
        for (const t of e.techStack) {
          if (typeof t === 'string') knownSkills.add(t.toLowerCase());
        }
      }
    }

    // Profile summary with real verified achievements
    const verifiedProjectsSummary = [
      ...projects.map((p) => `- Project: ${p.title} (${p.description ?? ''})`),
      ...experiences.slice(0, 3).map((e) => {
        const bullets = Array.isArray(e.bullets)
          ? (e.bullets as unknown[]).filter((b): b is string => typeof b === 'string').slice(0, 2).join('; ')
          : '';
        return `- Role: ${e.title} at ${e.company} (${bullets})`;
      }),
    ].join('\n');

    const profileContext = [
      `Candidate Name: ${profile?.fullName ?? 'Candidate'}`,
      `Headline: ${profile?.headline ?? 'Backend & AI Engineer (4+ yrs)'}`,
      `Location: Pakistan (requires visa sponsorship / open to relocation to KSA/UAE or remote)`,
      `Core Technologies: Node.js, NestJS, TypeScript, Python (FastAPI/AsyncIO), PostgreSQL, AWS Serverless, WebSockets/WebRTC, Voice AI (Whisper, Cartesia, Twilio Media Streams), LLM APIs`,
      `Verified Work & Projects:\n${verifiedProjectsSummary || '- Real-time Voice AI platform with sub-second latency\n- Saudi healthcare enterprise EHR/telemedicine platform\n- High-throughput NestJS/PostgreSQL backend services'}`,
    ].join('\n\n');

    const systemPrompt = `You are an expert tech talent outreach copywriter.
Generate a concise, high-converting outreach message pack for a candidate applying to "${jobTitle}" at "${companyName}".

HARD RULES:
1. CHARACTER LIMITS ARE STRICT CEILINGS:
   - recruiterDm: MAX 450 characters.
   - connectionNote: STRICTLY MAX 280 characters.
   - founderDm: MAX 450 characters (if startup) or null.
   - referralRequest: MAX 450 characters.
   - followUpDm: MAX 450 characters.
2. TRUTH GROUNDING: Reference 1 or 2 REAL items from the verified profile (e.g. sub-second Voice AI pipeline, Saudi healthcare platform, or high-throughput NestJS APIs). NEVER invent technologies, companies, years, or achievements not in the profile.
3. HONESTY: Explicitly and politely state that candidate is based in Pakistan and open to relocation / needs visa sponsorship, or remote work.
4. TONE: Professional, respectful, concise, zero hype, zero buzzwords.`;

    const userPrompt = `CANDIDATE PROFILE:\n${profileContext}\n\nTARGET OPPORTUNITY:\nCompany: ${companyName}\nRole: ${jobTitle}\nIs Startup: ${isStartup ? 'YES' : 'NO'}\nJob Description Excerpt:\n${opp.rawText.slice(0, 1500)}\n\nGenerate the complete outreach pack adhering to all character limits.`;

    let generated: z.infer<typeof OutreachGeneratedSchema>;
    try {
      generated = await this.llm.generateStructured({
        system: systemPrompt,
        prompt: userPrompt,
        schema: OutreachGeneratedSchema,
        purpose: 'outreach_pack_generation',
        userId,
      });
    } catch (err: unknown) {
      this.logger.warn(`LLM structured generation failed for outreach pack: ${String(err)}. Using grounded fallback templates.`);
      generated = this.buildFallbackOutreach(companyName, jobTitle, isStartup, profile?.fullName ?? 'Engineer');
    }

    if (!generated) {
      generated = this.buildFallbackOutreach(companyName, jobTitle, isStartup, profile?.fullName ?? 'Engineer');
    }

    // Hard clamp all message lengths to guaranteed limits
    const recruiterDm = this.clampLength(generated.recruiterDm, 450);
    const connectionNote = this.clampLength(generated.connectionNote, 280);
    const founderDm = generated.founderDm ? this.clampLength(generated.founderDm, 450) : null;
    const referralRequest = this.clampLength(generated.referralRequest, 450);
    const followUpDm = this.clampLength(generated.followUpDm, 450);

    // Verify for unknown technology hallucinations
    const unknownTechnologiesFlagged = this.detectUnknownTechnologies(
      [recruiterDm, connectionNote, founderDm ?? '', referralRequest, followUpDm].join(' '),
      knownSkills,
    );

    const linkedInUrls = {
      talentAcquisition: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(companyName)}%20talent%20acquisition`,
      engineeringManager: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(companyName)}%20engineering%20manager`,
    };

    const packResult: OutreachPackResult = {
      recruiterDm,
      connectionNote,
      founderDm,
      isStartup,
      referralRequest,
      followUpDm,
      linkedInUrls,
      highlightedProfileItems: generated.highlightedProfileItems ?? ['Real-time Voice AI pipeline', 'NestJS / PostgreSQL backend'],
      unknownTechnologiesFlagged,
      generatedAt: new Date().toISOString(),
    };

    // Save pack into opportunity
    await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        outreachPack: packResult as unknown as object,
        outreachStatus: opp.outreachStatus || 'not_sent',
      },
    });

    this.logger.log(`Outreach pack created for opp ${opportunityId} (${companyName})`);
    return packResult;
  }

  /**
   * Updates outreach status ('not_sent' | 'sent' | 'replied') and schedules follow-up if sent.
   */
  async updateOutreachStatus(
    opportunityId: string,
    userId: string,
    status: 'not_sent' | 'sent' | 'replied',
  ) {
    const opp = await this.prisma.opportunity.findFirst({
      where: { id: opportunityId, userId },
    });
    if (!opp) throw new NotFoundException(`Opportunity ${opportunityId} not found`);

    const now = new Date();
    const updateData: {
      outreachStatus: string;
      outreachSentAt?: Date | null;
      outreachFollowUpDue?: Date | null;
    } = {
      outreachStatus: status,
    };

    if (status === 'sent') {
      updateData.outreachSentAt = now;
      // Follow up due after 7 days
      updateData.outreachFollowUpDue = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (status === 'not_sent') {
      updateData.outreachSentAt = null;
      updateData.outreachFollowUpDue = null;
    }

    return this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: updateData,
      include: { requirement: true, match: true, applyPack: true },
    });
  }

  /**
   * Returns list of opportunities where outreach was sent and follow-up is due.
   */
  async getFollowUpsDue(userId: string) {
    return this.prisma.opportunity.findMany({
      where: {
        userId,
        outreachStatus: 'sent',
        outreachFollowUpDue: { lte: new Date() },
      },
      orderBy: { outreachFollowUpDue: 'asc' },
      include: { requirement: true, match: true },
    });
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────

  /**
   * Clamps string length cleanly without cutting off in an unreadable manner.
   */
  clampLength(text: string, maxLen: number): string {
    const trimmed = text.trim();
    if (trimmed.length <= maxLen) return trimmed;

    // Slice to maxLen and look for nearest sentence or word boundary
    const sliced = trimmed.slice(0, maxLen);
    const lastPunctuation = Math.max(
      sliced.lastIndexOf('.'),
      sliced.lastIndexOf('!'),
      sliced.lastIndexOf('?'),
    );
    if (lastPunctuation > maxLen * 0.7) {
      return sliced.slice(0, lastPunctuation + 1).trim();
    }
    const lastSpace = sliced.lastIndexOf(' ');
    if (lastSpace > maxLen * 0.8) {
      return sliced.slice(0, lastSpace).trim();
    }
    return sliced.trim();
  }

  /**
   * Detects if the company is an early-stage startup (< 100 employees or "startup" in data).
   */
  detectStartup(rawText: string, fieldsJson?: unknown): boolean {
    const text = (rawText || '').toLowerCase();
    const fields = (fieldsJson as Record<string, unknown>) || {};
    const companySize = typeof fields.companySize === 'string' ? fields.companySize.toLowerCase() : '';

    if (
      companySize.includes('1-10') ||
      companySize.includes('11-50') ||
      companySize.includes('51-100') ||
      companySize.includes('<100') ||
      companySize.includes('seed') ||
      companySize.includes('series a')
    ) {
      return true;
    }

    return (
      text.includes('early-stage') ||
      text.includes('early stage') ||
      text.includes('seed stage') ||
      text.includes('series a') ||
      text.includes('< 100 employees') ||
      text.includes('<100 employees') ||
      (text.includes('startup') && !text.includes('non-startup'))
    );
  }

  /**
   * Scans text for unknown technology names that do NOT exist in the candidate's profile.
   */
  detectUnknownTechnologies(text: string, knownSkills: Set<string>): string[] {
    const commonForeignTechs = [
      'c++', 'c#', 'rust', 'golang', 'go', 'php', 'ruby', 'rails', 'scala', 'clojure',
      'swift', 'kotlin', 'flutter', 'dart', 'solidity', 'blockchain', 'kubernetes', 'k8s',
      'terraform', 'graphql', 'mongodb', 'cassandra', 'hadoop', 'spark', 'kafka',
      'salesforce', 'sap', 'angular', 'vue',
    ];

    const words = text.toLowerCase().split(/[^a-z0-9+#]/).filter((w) => w.length > 1);
    const flagged: string[] = [];

    for (const tech of commonForeignTechs) {
      if (words.includes(tech) && !knownSkills.has(tech)) {
        flagged.push(tech);
      }
    }

    return Array.from(new Set(flagged));
  }

  /**
   * Grounded fallback templates respecting exact character boundaries.
   */
  private buildFallbackOutreach(
    company: string,
    role: string,
    isStartup: boolean,
    name: string,
  ): z.infer<typeof OutreachGeneratedSchema> {
    const recruiterDm = `Hi! I saw the ${role} opening at ${company}. I have 4+ yrs building Node.js/NestJS & Python backends, including real-time Voice AI and high-throughput APIs. Based in Pakistan, open to relocation (need visa sponsorship) or remote. Would love to share my profile if you are open to discussing fit. Best, ${name}`;
    const connectionNote = `Hi! Interested in the ${role} role at ${company}. I bring 4+ yrs in NestJS, Python & Voice AI pipelines. Open to relocation/sponsorship or remote. Would love to connect!`;
    const founderDm = isStartup
      ? `Hi! Love what ${company} is building. I am a backend/AI engineer (4+ yrs Node/NestJS/Python) experienced in shipping sub-second Voice AI & cloud APIs from 0 to scale. Open to relocation (need sponsorship) or remote. Would love to connect and help scale your backend.`
      : null;
    const referralRequest = `Hi! Hope you're well. I came across the ${role} role at ${company} and your engineering work. I have 4+ yrs in Node.js, NestJS & Voice AI. Would you be open to a quick chat or passing along my resume if there's mutual fit? No worries if not!`;
    const followUpDm = `Hi! Following up on my note regarding the ${role} role at ${company}. Still very interested in contributing my Node/NestJS and Voice AI background. Open to relocation (sponsorship needed) or remote. Thanks for your time!`;

    return {
      recruiterDm,
      connectionNote,
      founderDm,
      referralRequest,
      followUpDm,
      highlightedProfileItems: ['Real-time Voice AI pipeline', 'NestJS & PostgreSQL scalable APIs'],
    };
  }
}
