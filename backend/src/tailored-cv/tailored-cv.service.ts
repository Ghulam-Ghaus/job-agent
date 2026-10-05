import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service.js';
import { LlmService } from '../llm/llm.service.js';
import { OpportunitiesService } from '../opportunities/opportunities.service.js';
import { SkillLevel } from '../generated/prisma/enums.js';
import {
  AddSkillFromGapDto,
  GenerateCoverLetterDto,
  GenerateTailoredCvDto,
} from './dto/create-tailored-cv.dto.js';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const TailoredCvContentSchema = z.object({
  headline: z.string().describe('Targeted professional title/headline'),
  summary: z.string().describe('High-impact 3-4 sentence professional summary aligned to the target role'),
  skills: z.array(
    z.object({
      category: z.string().describe('Category like Backend, Cloud & DevOps, Databases, Languages, Architecture'),
      items: z.array(z.string()).describe('Skill names in this category, prioritizing target job requirements'),
    }),
  ),
  experiences: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string().optional(),
      period: z.string().describe('e.g. 2022 - Present or 2020 - 2022'),
      bullets: z.array(z.string()).describe('3-5 strong, active-voice accomplishment bullets relevant to role'),
      techStack: z.array(z.string()).describe('Technologies used in this role'),
    }),
  ),
  projects: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      highlights: z.array(z.string()).describe('Key achievements and capabilities demonstrated'),
      techStack: z.array(z.string()),
    }),
  ),
});

const CvVerifierSchema = z.object({
  status: z.enum(['passed', 'flagged']),
  issues: z.array(
    z.object({
      claim: z.string().describe('The specific unverified or embellished claim'),
      reason: z.string().describe('Why this claim is unverified against master profile'),
    }),
  ),
});

const CoverLetterSchema = z.object({
  coverLetter: z.string().describe('Professional, compelling cover letter (250-350 words)'),
  keyHooks: z.array(z.string()).describe('Top 2-3 value propositions matching employer needs'),
});

export type CvStyle = 'GULF' | 'EUROPE';

const GULF_LOCATION_RE =
  /\b(saudi|ksa|riyadh|jeddah|dammam|khobar|neom|uae|united arab emirates|dubai|abu dhabi|sharjah|qatar|doha|kuwait|bahrain|manama|oman|muscat|gcc|gulf|middle east|mena)\b/i;

/**
 * Gulf/GCC location -> GULF layout; everything else (UK, EU, remote/international, unknown) -> EUROPE.
 * Unknown defaults to the international layout, which exposes fewer personal fields.
 */
export function detectCvStyle(locationText: string | null | undefined): CvStyle {
  return locationText && GULF_LOCATION_RE.test(locationText) ? 'GULF' : 'EUROPE';
}

@Injectable()
export class TailoredCvService {
  private readonly logger = new Logger(TailoredCvService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly opportunitiesService: OpportunitiesService,
  ) {}

  // ─── 1. Tailored CV Generation ─────────────────────────────────────────────

  async generateTailoredCv(userId: string, dto: GenerateTailoredCvDto) {
    // 1. Gather candidate master profile data
    const [profile, skills, experiences, projects, user] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.skill.findMany({ where: { userId } }),
      this.prisma.experience.findMany({
        where: { userId },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.project.findMany({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);

    if (!profile) {
      throw new BadRequestException('Master profile not found. Please complete profile first.');
    }

    // 2. Resolve target job context
    let targetRole = dto.targetRole || 'Software Engineer';
    let jobDescription = dto.jobDescription || '';
    let companyName = 'Hiring Organization';

    if (dto.opportunityId) {
      const opp = await this.prisma.opportunity.findFirst({
        where: { id: dto.opportunityId, userId },
        include: { requirement: true },
      });
      if (opp) {
        targetRole = opp.title || targetRole;
        companyName = opp.company || companyName;
        jobDescription = opp.rawText || JSON.stringify(opp.requirement?.fieldsJson ?? '');
      }
    }

    // 3. Compute deterministic input hash for content-based caching
    const confirmedSkillNames = skills.map((s) => s.name.toLowerCase()).sort().join('|');
    const inputHash = createHash('sha256')
      .update(`${userId}::${targetRole}::${confirmedSkillNames}::${jobDescription.slice(0, 500)}`)
      .digest('hex');

    // Return cached if exists and not force-regenerating
    if (!dto.forceRegenerate) {
      const cached = await this.prisma.tailoredCv.findFirst({
        where: { userId, inputHash },
        orderBy: { createdAt: 'desc' },
      });
      if (cached) {
        this.logger.log(`Returning cached TailoredCv ${cached.id} for user ${userId}`);
        return cached;
      }
    }

    // 4. Build profile summary for LLM prompt
    const candidateSummary = [
      `Name: ${profile.fullName || 'Ghulam Ghaus'}`,
      `Headline: ${profile.headline || targetRole}`,
      `Email: ${user?.email || 'admin@jobagent.local'}`,
      `Phone: ${profile.phone || ''}`,
      `Location: ${[profile.location, profile.country].filter(Boolean).join(', ')}`,
      `LinkedIn: ${profile.linkedinUrl || ''}`,
      `GitHub: ${profile.githubUrl || ''}`,
      `Portfolio: ${profile.portfolioUrl || ''}`,
      `Skills in Profile:`,
      ...skills.map((s) => `  - ${s.name} (${s.level}, category: ${s.category || 'General'})`),
      `Experience:`,
      ...experiences.map(
        (e) =>
          `  - ${e.title} at ${e.company} (${new Date(e.startDate).getFullYear()} - ${e.isCurrent ? 'Present' : e.endDate ? new Date(e.endDate).getFullYear() : '?'})\n    Tech: ${JSON.stringify(e.techStack)}\n    Bullets: ${JSON.stringify(e.bullets)}`,
      ),
      `Projects:`,
      ...projects.map(
        (p) =>
          `  - ${p.title}: ${p.description || ''}\n    Tech: ${JSON.stringify(p.techStack)}\n    Highlights: ${JSON.stringify(p.highlights)}`,
      ),
    ].join('\n');

    // 5. Pass 1: Generate Tailored CV structure with Zod schema
    const prompt = `CANDIDATE MASTER PROFILE (Ground Truth Only):\n${candidateSummary}\n\nTARGET ROLE: ${targetRole}\nCOMPANY: ${companyName}\n\nJOB REQUIREMENTS & CONTEXT:\n${jobDescription.slice(0, 3000)}\n\n${
      dto.emphasizedSkills?.length
        ? `USER-REQUESTED SKILLS TO EMPHASIZE:\n${dto.emphasizedSkills.join(', ')}\n\n`
        : ''
    }Task: Build a tailored, ATS-optimized CV structure for this specific position.
RULES:
1. Every skill and tool MUST exist in the candidate master profile above. NEVER invent new skills, certifications, or tools.
2. Group the candidate's verified skills into clear categories, placing the ones demanded by the job first.
3. Write an impactful 3-4 sentence professional summary tailored to this position, referencing verified years and strengths.
4. Select and refine the most relevant experience bullets to directly answer what this employer is looking for.
5. Highlight 2-3 most relevant projects with their actual tech stacks.`;

    const generated = await this.llm.generateStructured({
      system:
        'You are an elite executive resume writer and ATS specialist. You create high-impact, truthful CVs tailored specifically to job requirements based strictly on verified profile data.',
      prompt,
      schema: TailoredCvContentSchema,
      purpose: 'tailored_cv_generation',
      userId,
    });

    // 6. Pass 2: Verifier check against master profile data
    const verifierPrompt = `CANDIDATE MASTER PROFILE:\n${candidateSummary}\n\nGENERATED CV CONTENT TO VERIFY:\n${JSON.stringify(generated, null, 2)}\n\nTask: Verify every factual claim, skill, company name, and metric against the candidate profile. Return status 'passed' if truthful, or 'flagged' with exact issues if anything is invented.`;

    const verifier = await this.llm.generateStructured({
      system:
        'You are a strict recruitment compliance auditor. You verify that every technical claim, skill, tool, company, and project exists in the candidate ground truth profile. Absolutely zero hallucinations allowed.',
      prompt: verifierPrompt,
      schema: CvVerifierSchema,
      purpose: 'tailored_cv_verification',
      userId,
    });

    // 7. Store in database
    return this.prisma.tailoredCv.create({
      data: {
        userId,
        opportunityId: dto.opportunityId,
        targetRole,
        inputHash,
        contentJson: generated,
        verifierStatus: verifier.status,
        verifierIssues: verifier.issues,
        promptVersion: 'v1',
      },
    });
  }

  async getTailoredCv(id: string, userId: string) {
    const cv = await this.prisma.tailoredCv.findFirst({
      where: { id, userId },
      include: { opportunity: true },
    });
    if (!cv) throw new NotFoundException('Tailored CV not found');
    return cv;
  }

  async listTailoredCvs(userId: string, opportunityId?: string) {
    return this.prisma.tailoredCv.findMany({
      where: {
        userId,
        ...(opportunityId ? { opportunityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { opportunity: { select: { id: true, title: true, company: true } } },
    });
  }

  // ─── 2. PDFKit PDF Rendering ───────────────────────────────────────────────

  async renderPdfBuffer(
    tailoredCvId: string,
    userId: string,
    styleOverride?: string,
  ): Promise<{ buffer: Buffer; filename: string; style: CvStyle }> {
    const tailoredCv = await this.getTailoredCv(tailoredCvId, userId);
    const [profile, user, prefs] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
      this.prisma.jobPreference.findUnique({ where: { userId } }),
    ]);

    // Style: explicit choice > saved preference > auto-detect from the opportunity location
    const locationLine = tailoredCv.opportunity?.rawText?.match(/^Location:\s*(.+)$/im)?.[1];
    const locationText = [tailoredCv.opportunity?.country, locationLine].filter(Boolean).join(' ');
    const requested = (styleOverride ?? '').toUpperCase();
    const saved = (prefs?.cvStyle ?? 'AUTO').toUpperCase();
    const style: CvStyle =
      requested === 'GULF' || requested === 'EUROPE'
        ? requested
        : saved === 'GULF' || saved === 'EUROPE'
          ? saved
          : detectCvStyle(locationText);

    const content = tailoredCv.contentJson as z.infer<typeof TailoredCvContentSchema>;
    const fullName = profile?.fullName || 'Ghulam Ghaus';
    const email = user?.email || 'admin@jobagent.local';
    const phone = profile?.phone || '';
    const location = [profile?.location, profile?.country].filter(Boolean).join(', ');
    const linkedin = profile?.linkedinUrl || '';
    const github = profile?.githubUrl || '';
    const portfolio = profile?.portfolioUrl || '';
    const languages = (Array.isArray(profile?.languages) ? profile.languages : []) as Array<{
      language?: string;
      level?: string;
    }>;
    const languageText = languages
      .filter((l) => l.language)
      .map((l) => (l.level ? `${l.language} (${l.level})` : l.language))
      .join(', ');

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          info: {
            Title: `${fullName} - ${tailoredCv.targetRole} CV`,
            Author: fullName,
            Subject: `Tailored CV for ${tailoredCv.targetRole}`,
            Creator: 'JobAgent AI Career Platform',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const sanitizedRole = tailoredCv.targetRole.replace(/[^a-zA-Z0-9]/g, '_');
          const sanitizedName = fullName.replace(/[^a-zA-Z0-9]/g, '_');
          resolve({
            buffer,
            filename: `${sanitizedName}_${sanitizedRole}_CV_${style === 'GULF' ? 'GCC' : 'EU'}.pdf`,
            style,
          });
        });
        doc.on('error', reject);

        // ── Header Section ───────────────────────────────────────────────────
        doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text(fullName, { align: 'center' });
        doc.moveDown(0.2);

        doc.font('Helvetica-Bold').fontSize(11).fillColor('#4338ca').text(content.headline || tailoredCv.targetRole, {
          align: 'center',
        });
        doc.moveDown(0.3);

        const contactParts = [email, phone, location].filter(Boolean);
        const linkParts = [linkedin, github, portfolio].filter(Boolean);

        doc.font('Helvetica').fontSize(9).fillColor('#475569').text(contactParts.join('  •  '), {
          align: 'center',
        });
        if (linkParts.length > 0) {
          doc.moveDown(0.1);
          doc.text(linkParts.join('  •  '), { align: 'center' });
        }

        // Gulf/GCC recruiters expect availability facts up front. Only profile data is used.
        if (style === 'GULF') {
          const visa = profile?.visaStatus || 'Unknown';
          const notice =
            profile?.noticePeriodDays !== null && profile?.noticePeriodDays !== undefined
              ? `${profile.noticePeriodDays} days`
              : 'Unknown';
          const relocate = profile?.willingToRelocate ? 'Yes' : 'No';
          doc.moveDown(0.15);
          doc
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .fillColor('#0f172a')
            .text(`Visa Status: ${visa}  |  Notice Period: ${notice}  |  Open to Relocation: ${relocate}`, {
              align: 'center',
            });
          if (languageText) {
            doc.font('Helvetica').fontSize(8.5).fillColor('#475569').text(`Languages: ${languageText}`, {
              align: 'center',
            });
          }
        }

        doc.moveDown(0.6);
        doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.6);

        // ── Helper: Section Title ────────────────────────────────────────────
        const addSectionHeading = (title: string) => {
          doc.moveDown(0.4);
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e1b4b').text(title.toUpperCase(), {
            characterSpacing: 0.5,
          });
          doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).stroke();
          doc.moveDown(0.4);
        };

        // ── Summary Section ──────────────────────────────────────────────────
        if (content.summary) {
          addSectionHeading('Professional Summary');
          doc.font('Helvetica').fontSize(9.5).fillColor('#1e293b').lineGap(2).text(content.summary, {
            align: 'justify',
          });
          doc.moveDown(0.4);
        }

        // ── Core Skills Section ──────────────────────────────────────────────
        if (content.skills && content.skills.length > 0) {
          addSectionHeading('Core Technical Competencies');
          for (const grp of content.skills) {
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(`${grp.category}: `, { continued: true });
            doc.font('Helvetica').fontSize(9).fillColor('#334155').text(grp.items.join(', '));
            doc.moveDown(0.15);
          }
          doc.moveDown(0.4);
        }

        // ── Professional Experience Section ──────────────────────────────────
        if (content.experiences && content.experiences.length > 0) {
          addSectionHeading('Professional Experience');
          for (const exp of content.experiences) {
            // Check page overflow
            if (doc.y > 700) doc.addPage();

            const roleCompany = `${exp.title} | ${exp.company}${exp.location ? ` - ${exp.location}` : ''}`;
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(roleCompany, { continued: true });
            doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(exp.period, { align: 'right' });

            if (exp.techStack && exp.techStack.length > 0) {
              doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#4338ca').text(`Technologies: ${exp.techStack.join(', ')}`);
              doc.moveDown(0.2);
            }

            for (const bullet of exp.bullets) {
              doc.font('Helvetica').fontSize(9).fillColor('#1e293b').text(`•  ${bullet}`, {
                indent: 10,
                lineGap: 1.5,
              });
            }
            doc.moveDown(0.4);
          }
        }

        // ── Featured Projects Section ────────────────────────────────────────
        if (content.projects && content.projects.length > 0) {
          if (doc.y > 680) doc.addPage();
          addSectionHeading('Key Projects & Solutions');
          for (const proj of content.projects) {
            doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(proj.title);
            doc.font('Helvetica').fontSize(9).fillColor('#334155').text(proj.description);

            if (proj.techStack && proj.techStack.length > 0) {
              doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#4338ca').text(`Tech Stack: ${proj.techStack.join(', ')}`);
            }

            for (const hl of proj.highlights || []) {
              doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b').text(`•  ${hl}`, { indent: 10 });
            }
            doc.moveDown(0.3);
          }
        }

        // European/international layout: languages as a dedicated closing section (no visa/availability block)
        if (style === 'EUROPE' && languageText) {
          if (doc.y > 700) doc.addPage();
          addSectionHeading('Languages');
          doc.font('Helvetica').fontSize(9).fillColor('#334155').text(languageText);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── 3. 1-Click Skill Adoption from Gap ─────────────────────────────────────

  async addSkillFromGap(userId: string, dto: AddSkillFromGapDto) {
    const skillName = dto.name.trim();
    if (!skillName) {
      throw new BadRequestException('Skill name cannot be empty');
    }

    // Upsert skill in user profile
    const skill = await this.prisma.skill.upsert({
      where: {
        userId_name: {
          userId,
          name: skillName,
        },
      },
      create: {
        userId,
        name: skillName,
        level: dto.level || SkillLevel.INTERMEDIATE,
        category: dto.category || 'Backend',
        yearsOfExp: 2,
      },
      update: {
        level: dto.level || SkillLevel.INTERMEDIATE,
        category: dto.category || undefined,
      },
    });

    this.logger.log(`User ${userId} confirmed skill "${skillName}" into Master Profile.`);

    // If opportunityId was passed, automatically re-score the opportunity
    let rescoredOpportunity = null;
    if (dto.opportunityId) {
      rescoredOpportunity = await this.opportunitiesService.reprocess(dto.opportunityId, userId);
      this.logger.log(`Re-scored opportunity ${dto.opportunityId} after skill update.`);
    }

    return {
      success: true,
      skill,
      rescoredOpportunity,
      message: `Added "${skillName}" to Master Profile and re-scored opportunity.`,
    };
  }

  // ─── 4. Cover Letter Generation & PDF ───────────────────────────────────────

  async generateCoverLetter(userId: string, dto: GenerateCoverLetterDto) {
    const opp = await this.prisma.opportunity.findFirst({
      where: { id: dto.opportunityId, userId },
      include: { requirement: true },
    });

    if (!opp) throw new NotFoundException('Opportunity not found');

    const [profile, skills, experiences, user] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.skill.findMany({ where: { userId } }),
      this.prisma.experience.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);

    const inputHash = createHash('sha256')
      .update(`${userId}::cover::${opp.id}::${opp.title}::${skills.length}`)
      .digest('hex');

    if (!dto.forceRegenerate) {
      const cached = await this.prisma.coverLetter.findFirst({
        where: { userId, opportunityId: dto.opportunityId },
        orderBy: { createdAt: 'desc' },
      });
      if (cached) return cached;
    }

    const candidateProfileText = [
      `Name: ${profile?.fullName || 'Ghulam Ghaus'}`,
      `Email: ${user?.email || 'admin@jobagent.local'}`,
      `Headline: ${profile?.headline || 'Senior Full-Stack & AI Engineer'}`,
      `Skills: ${skills.map((s) => s.name).join(', ')}`,
      `Key Roles:`,
      ...experiences.slice(0, 3).map((e) => `  - ${e.title} at ${e.company} (${JSON.stringify(e.techStack)})`),
    ].join('\n');

    const prompt = `CANDIDATE MASTER PROFILE (Ground Truth Only):\n${candidateProfileText}\n\nJOB DETAILS:\nRole: ${opp.title || 'Software Engineer'}\nCompany: ${opp.company || 'Company'}\nLocation: ${opp.country || ''}\nJob Requirements:\n${opp.rawText.slice(0, 2500)}\n\nTask: Write an outstanding, tailored cover letter.
RULES:
1. Every qualification, metric, tool, and company MUST be strictly true to candidate profile.
2. Hook the employer immediately with relevant achievements.
3. Keep it professional, human, and between 250-350 words.`;

    const generated = await this.llm.generateStructured({
      system:
        'You are a high-conversion career strategist. You write compelling, factual cover letters tailored to job requirements without ever fabricating experience.',
      prompt,
      schema: CoverLetterSchema,
      purpose: 'cover_letter_generation',
      userId,
    });

    return this.prisma.coverLetter.upsert({
      where: { id: (await this.prisma.coverLetter.findFirst({ where: { userId, opportunityId: opp.id } }))?.id || 'none' },
      create: {
        userId,
        opportunityId: opp.id,
        inputHash,
        body: generated.coverLetter,
        verifierStatus: 'passed',
      },
      update: {
        inputHash,
        body: generated.coverLetter,
        bodyEdited: null,
      },
    });
  }

  async renderCoverLetterPdf(coverLetterId: string, userId: string): Promise<{ buffer: Buffer; filename: string }> {
    const letter = await this.prisma.coverLetter.findFirst({
      where: { id: coverLetterId, userId },
      include: { opportunity: true },
    });

    if (!letter) throw new NotFoundException('Cover letter not found');

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

    const fullName = profile?.fullName || 'Ghulam Ghaus';
    const email = user?.email || 'admin@jobagent.local';
    const phone = profile?.phone || '';
    const body = letter.bodyEdited || letter.body;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const filename = `Cover_Letter_${fullName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
          resolve({ buffer, filename });
        });
        doc.on('error', reject);

        // Header
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text(fullName);
        doc.font('Helvetica').fontSize(9).fillColor('#64748b').text([email, phone, profile?.location].filter(Boolean).join('  •  '));
        doc.moveDown(0.5);
        doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1.5);

        // Date & Recipient
        doc.font('Helvetica').fontSize(9).fillColor('#475569').text(new Date().toLocaleDateString('en-US', { dateStyle: 'long' }));
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(`Hiring Team at ${letter.opportunity?.company || 'Company'}`);
        if (letter.opportunity?.title) {
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#4338ca').text(`Application for: ${letter.opportunity.title}`);
        }
        doc.moveDown(1);

        // Body
        doc.font('Helvetica').fontSize(10).fillColor('#1e293b').lineGap(4).text(body, {
          align: 'left',
        });

        doc.moveDown(1.5);
        doc.font('Helvetica').fontSize(10).text('Sincerely,');
        doc.moveDown(0.4);
        doc.font('Helvetica-Bold').fontSize(10).text(fullName);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
