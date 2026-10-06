import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

const ScreeningAnswersSchema = z.object({
  answers: z.array(
    z.object({
      question: z.string(),
      answer: z.string().describe('High-impact, concise answer (80-160 words) answering the prompt directly using verified candidate facts'),
      keyProjectsCited: z.array(z.string()).describe('Titles of verified projects cited in this answer'),
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

    // ── Pass 1: Generate cover note or freelance proposal ──────────────
    const isFreelance = opp.type === 'FREELANCE';
    this.logger.log(`Pass 1: Generating ${isFreelance ? 'freelance proposal' : 'cover note'} for opp ${opportunityId}`);

    const systemPrompt = isFreelance
      ? `You are an expert freelance proposal writer crafting a winning Upwork proposal.
RULES:
- Hook the client in the very first sentence by directly addressing their project requirements/problem. Do NOT start with "Dear Hiring Manager", "I hope you are well", or generic pleasantries.
- Only reference skills, experience, and past achievements that exist in the candidate's profile below.
- Highlight 2-3 specific relevant technologies and past experiences from the profile.
- Include 1-2 thoughtful, clarifying technical questions showing you understand the project scope.
- Keep it punchy and concise (150-250 words), focused on delivering client value.
- Do NOT invent or embellish any qualifications or metrics.`
      : `You are a professional job application writer. Write a concise, compelling cover note tailored to the specific job.
RULES:
- Only mention skills, experience, and achievements that exist in the candidate's profile below.
- Do NOT invent or embellish any qualifications.
- Keep it under 300 words.
- Be specific — reference actual companies, technologies, and years from the profile.
- Sound professional but human, not robotic.`;

    const userPrompt = isFreelance
      ? `CANDIDATE PROFILE:\n${profileSummary}\n\nPROJECT REQUIREMENTS:\n${JSON.stringify(fields, null, 2)}\n\nProject Title: ${opp.title ?? 'Freelance Project'}\nClient: ${opp.company ?? 'Client'}\n\nWrite a tailored, high-converting Upwork proposal for this contract.`
      : `CANDIDATE PROFILE:\n${profileSummary}\n\nJOB REQUIREMENTS:\n${JSON.stringify(fields, null, 2)}\n\nJob Title: ${opp.title ?? 'Unknown'}\nCompany: ${opp.company ?? 'Unknown'}\n\nWrite a tailored cover note for this application.`;

    const pass1 = await this.llm.generateStructured({
      system: systemPrompt,
      prompt: userPrompt,
      schema: CoverNoteSchema,
      purpose: isFreelance ? 'freelance_proposal_generation' : 'apply_pack_generation',
      userId,
    });

    // ── Pass 2: Verify claims ───────────────────────────────────────────
    this.logger.log(`Pass 2: Verifying claims for opp ${opportunityId}`);

    const pass2 = await this.llm.generateStructured({
      system: `You are a strict fact-checker. Your job is to verify every claim in a ${isFreelance ? 'freelance proposal' : 'cover letter'} against the candidate's actual profile data.
RULES:
- If the text mentions a skill, company, role, or achievement NOT found in the profile, flag it.
- If the text exaggerates years of experience beyond what the profile shows, flag it.
- If everything checks out, return status "passed" with an empty issues array.
- Be thorough — false claims in applications or proposals are strictly prohibited.`,
      prompt: `CANDIDATE PROFILE:\n${profileSummary}\n\nPROPOSAL/NOTE TO VERIFY:\n${pass1.coverNote}\n\nVerify every factual claim in this text against the candidate's profile.`,
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

  /**
   * Generate grounded, truthful answers to specific HR screening questions for an opportunity.
   */
  async generateScreeningAnswers(opportunityId: string, userId: string, questions: string[]) {
    if (!questions || questions.length === 0) {
      throw new BadRequestException('At least one question is required');
    }

    const [opp, profile, skills, experiences, projects, user] = await Promise.all([
      this.prisma.opportunity.findFirst({
        where: { id: opportunityId, userId },
        include: { requirement: true },
      }),
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.skill.findMany({ where: { userId } }),
      this.prisma.experience.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
      this.prisma.project.findMany({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);

    if (!opp) throw new NotFoundException('Opportunity not found');

    const candidateProfileText = [
      `Name: ${profile?.fullName || 'Ghulam Ghaus'}`,
      `Email: ${user?.email || 'admin@jobagent.local'}`,
      `Headline: ${profile?.headline || 'Senior Full-Stack & AI Engineer'}`,
      `Location / Country: ${profile?.location || ''} ${profile?.country || 'Pakistan'}`,
      `Visa / Relocation: ${profile?.visaStatus || 'Open to relocation'}, Willing to relocate: ${profile?.willingToRelocate ?? true}`,
      `Notice Period: ${profile?.noticePeriodDays ?? 15} days`,
      `Skills: ${skills.map((s) => s.name).join(', ')}`,
      `Key Roles:`,
      ...experiences.slice(0, 3).map((e) => `  - ${e.title} at ${e.company} (${JSON.stringify(e.techStack)})`),
      `Verified Projects & Case Studies:`,
      ...projects.map(
        (p) =>
          `  - ${p.title}: ${p.description || ''} (Tech: ${JSON.stringify(p.techStack)}, Highlights: ${JSON.stringify(p.highlights)})`,
      ),
    ].join('\n');

    const prompt = `CANDIDATE MASTER PROFILE (Ground Truth Only):\n${candidateProfileText}\n\nTARGET JOB & COMPANY:\nRole: ${opp.title || 'Software Engineer'}\nCompany: ${opp.company || 'Hiring Company'}\nLocation: ${opp.country || ''} ${opp.city || ''}\nJob Requirements / Context:\n${(opp.rawText || '').slice(0, 2500)}\n\nHR SCREENING QUESTIONS TO ANSWER:\n${questions.map((q, i) => `${i + 1}. "${q}"`).join('\n')}\n\nTask: Generate compelling, professional, and authentic answers for each HR screening question.
RULES:
1. Every qualification, metric, tool, and company MUST be strictly true to candidate profile. Zero hallucinations.
2. Address the company and role directly. If asked "Why this company / Why this program" (e.g. Tamara, etc.), explain genuine alignment with their mission and connect your verified background directly to what they build.
3. If asked about internships or co-ops and the candidate has professional freelance/engineering project experience instead, frame real-world production deliverables and client systems truthfully.
4. Keep each answer concise, confident, and between 80-160 words.
5. In each answer, cite relevant verified projects from the profile as concrete proof points.`;

    const generated = await this.llm.generateStructured({
      system:
        'You are an elite executive career strategist helping a senior engineer answer HR and ATS screening questions. You craft punchy, persuasive, and completely truthful answers grounded strictly in verified profile facts.',
      prompt,
      schema: ScreeningAnswersSchema,
      purpose: 'screening_answers_generation',
      userId,
    });

    // Save to ApplyPack.answersFilled
    const existingPack = await this.prisma.applyPack.findFirst({
      where: { opportunityId, userId },
    });

    const newAnswersFilled = generated.answers.map((a) => ({
      question: a.question,
      answer: a.answer,
      keyProjectsCited: a.keyProjectsCited,
    }));

    if (existingPack) {
      await this.prisma.applyPack.update({
        where: { id: existingPack.id },
        data: {
          answersFilled: newAnswersFilled,
        },
      });
    }

    // Also upsert into user's AnswerBankItem for permanent reuse
    for (const a of generated.answers) {
      const existingBankItem = await this.prisma.answerBankItem.findFirst({
        where: { userId, question: a.question },
      });
      if (existingBankItem) {
        await this.prisma.answerBankItem.update({
          where: { id: existingBankItem.id },
          data: { answer: a.answer },
        });
      } else {
        await this.prisma.answerBankItem.create({
          data: {
            userId,
            question: a.question,
            answer: a.answer,
            tags: [opp.company || 'General', opp.title || 'Screening'],
          },
        });
      }
    }

    return {
      opportunityId,
      company: opp.company,
      title: opp.title,
      answers: generated.answers,
    };
  }
}
