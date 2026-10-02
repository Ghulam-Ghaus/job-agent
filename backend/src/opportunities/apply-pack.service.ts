import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service.js';
import { LlmService } from '../llm/llm.service.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CoverNoteSchema = z.object({
  coverNote: z.string().describe('A tailored cover letter / application note'),
  keyPoints: z.array(z.string()).describe('Key selling points highlighted'),
});

const VerifierSchema = z.object({
  status: z.enum(['passed', 'flagged']),
  issues: z.array(
    z.object({
      claim: z.string().describe('The specific claim made in the cover note'),
      reason: z.string().describe('Why this claim could not be verified'),
    }),
  ),
});

@Injectable()
export class ApplyPackService {
  private readonly logger = new Logger(ApplyPackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  /**
   * Build an apply pack for an opportunity:
   * Pass 1: Generate tailored cover note
   * Pass 2: Verify every claim against user's actual profile data
   */
  async buildPack(opportunityId: string, userId: string) {
    // ── Load all needed data ──────────────────────────────────────────────
    const [opp, profile, skills, experiences, cvs, answerBank] = await Promise.all([
      this.prisma.opportunity.findFirst({
        where: { id: opportunityId, userId },
        include: { requirement: true, match: true },
      }),
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.skill.findMany({ where: { userId } }),
      this.prisma.experience.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
      this.prisma.cv.findMany({ where: { userId }, select: { id: true, isDefault: true, label: true } }),
      this.prisma.answerBankItem.findMany({ where: { userId } }),
    ]);

    if (!opp) throw new NotFoundException('Opportunity not found');
    if (!opp.requirement) throw new NotFoundException('Opportunity not yet extracted — run extraction first');

    const fields = opp.requirement.fieldsJson as Record<string, unknown>;

    // Build profile summary for the LLM
    const profileSummary = [
      `Name: ${profile?.fullName ?? 'Unknown'}`,
      `Headline: ${profile?.headline ?? 'N/A'}`,
      `Location: ${profile?.country ?? 'N/A'}`,
      `Skills: ${skills.map((s) => `${s.name} (${s.level}, ${s.yearsOfExp ?? '?'}y)`).join(', ')}`,
      `Experience:`,
      ...experiences.slice(0, 5).map(
        (e) =>
          `  - ${e.title} at ${e.company} (${new Date(e.startDate).getFullYear()}–${e.isCurrent ? 'present' : e.endDate ? new Date(e.endDate).getFullYear() : '?'})`,
      ),
      `Visa: ${profile?.visaStatus ?? 'N/A'}`,
      `Notice: ${profile?.noticePeriodDays ?? '?'} days`,
    ].join('\n');

    // ── Pass 1: Generate cover note ─────────────────────────────────────
    this.logger.log(`Pass 1: Generating cover note for opp ${opportunityId}`);

    const pass1 = await this.llm.generateStructured({
      system: `You are a professional job application writer. Write a concise, compelling cover note tailored to the specific job.
RULES:
- Only mention skills, experience, and achievements that exist in the candidate's profile below.
- Do NOT invent or embellish any qualifications.
- Keep it under 300 words.
- Be specific — reference actual companies, technologies, and years from the profile.
- Sound professional but human, not robotic.`,
      prompt: `CANDIDATE PROFILE:\n${profileSummary}\n\nJOB REQUIREMENTS:\n${JSON.stringify(fields, null, 2)}\n\nJob Title: ${opp.title ?? 'Unknown'}\nCompany: ${opp.company ?? 'Unknown'}\n\nWrite a tailored cover note for this application.`,
      schema: CoverNoteSchema,
      purpose: 'apply_pack_generation',
      userId,
    });

    // ── Pass 2: Verify claims ───────────────────────────────────────────
    this.logger.log(`Pass 2: Verifying cover note claims for opp ${opportunityId}`);

    const pass2 = await this.llm.generateStructured({
      system: `You are a strict fact-checker. Your job is to verify every claim in a cover letter against the candidate's actual profile data.
RULES:
- If the cover note mentions a skill, company, role, or achievement NOT found in the profile, flag it.
- If the cover note exaggerates years of experience beyond what the profile shows, flag it.
- If everything checks out, return status "passed" with an empty issues array.
- Be thorough — false claims in applications are serious.`,
      prompt: `CANDIDATE PROFILE:\n${profileSummary}\n\nCOVER NOTE TO VERIFY:\n${pass1.coverNote}\n\nVerify every factual claim in this cover note against the candidate's profile.`,
      schema: VerifierSchema,
      purpose: 'apply_pack_verification',
      userId,
    });

    // ── Select best CV ──────────────────────────────────────────────────
    const defaultCv = cvs.find((c) => c.isDefault);
    const selectedCvId = defaultCv?.id ?? cvs[0]?.id ?? null;

    // ── Pre-fill answer bank ────────────────────────────────────────────
    const answersFilled = answerBank.slice(0, 10).map((a) => ({
      question: a.question,
      answer: a.answer,
    }));

    // ── Save pack ───────────────────────────────────────────────────────
    const pack = await this.prisma.applyPack.upsert({
      where: { opportunityId },
      create: {
        opportunityId,
        userId,
        coverNote: pass1.coverNote,
        selectedCvId,
        answersFilled,
        verifierStatus: pass2.status,
        verifierIssues: pass2.issues,
      },
      update: {
        coverNote: pass1.coverNote,
        selectedCvId,
        answersFilled,
        verifierStatus: pass2.status,
        verifierIssues: pass2.issues,
        coverNoteEdited: null, // reset edits on rebuild
      },
    });

    // ── Update opportunity status ───────────────────────────────────────
    const newStatus = pass2.status === 'passed' ? 'AWAITING_APPROVAL' : 'DRAFT_READY';
    await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: newStatus },
    });

    this.logger.log(
      `Apply pack built for opp ${opportunityId}: verifier=${pass2.status}, issues=${pass2.issues.length}`,
    );

    return pack;
  }

  /** Get pack for an opportunity */
  async getPack(opportunityId: string, userId: string) {
    const pack = await this.prisma.applyPack.findFirst({
      where: { opportunityId, userId },
      include: { approval: true },
    });
    if (!pack) throw new NotFoundException('Apply pack not found');
    return pack;
  }

  /** Update the edited cover note */
  async updateCoverNote(opportunityId: string, userId: string, editedNote: string) {
    const pack = await this.getPack(opportunityId, userId);
    return this.prisma.applyPack.update({
      where: { id: pack.id },
      data: { coverNoteEdited: editedNote },
    });
  }
}
