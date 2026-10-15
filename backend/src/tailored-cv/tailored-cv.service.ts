import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
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

const EUROPE_LOCATION_RE =
  /\b(uk|united kingdom|london|europe|eu|germany|berlin|france|paris|netherlands|amsterdam|sweden|ireland|dublin)\b/i;

/**
 * Explicit UK/Europe location -> EUROPE layout.
 * Default for all other jobs (Gulf, Pakistan, Remote, International) -> GULF layout with professional photo.
 */
export function detectCvStyle(locationText: string | null | undefined): CvStyle {
  return locationText && EUROPE_LOCATION_RE.test(locationText) ? 'EUROPE' : 'GULF';
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
5. RELEVANCE-ONLY PROJECT SELECTION: From the candidate's verified projects list, dynamically rank and select ONLY the top 2-3 most relevant projects whose tech stack and domain directly match this job description. Do NOT include irrelevant projects.`;

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
    const email =
      user?.email && !user.email.endsWith('@jobagent.local')
        ? user.email
        : 'ghulamghaus266@gmail.com';
    const phone = profile?.phone || '+92 306 7956164';
    const location = 'Pakistan (Relocation: KSA / UAE)';
    const linkedin = profile?.linkedinUrl || 'linkedin.com/in/ghulam-ghaus-5b4ba9194/';
    const github = profile?.githubUrl || 'https://github.com/Ghulam-Ghaus';
    const portfolio = profile?.portfolioUrl || 'gghaus-portfolio.web.app';
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
          margins: { top: 30, bottom: 25, left: 36, right: 36 },
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

        if (style === 'GULF') {
          this.renderGulfCvPdf(doc, {
            profile,
            user,
            content,
            tailoredCv,
            fullName,
            email,
            phone,
            location,
            linkedin,
            portfolio,
          });
        } else {
          this.renderEuropeanCvPdf(doc, {
            content,
            tailoredCv,
            fullName,
            email,
            phone,
            location,
            linkedin,
            github,
            portfolio,
            languageText,
          });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private renderGulfCvPdf(
    doc: PDFKit.PDFDocument,
    data: {
      profile: any;
      user: any;
      content: z.infer<typeof TailoredCvContentSchema>;
      tailoredCv: any;
      fullName: string;
      email: string;
      phone: string;
      location: string;
      linkedin: string;
      portfolio: string;
    },
  ) {
    const { content, tailoredCv, fullName, email, phone, linkedin, portfolio } = data;

    // Helper: navy banner ribbon
    const drawBanner = (title: string, yPos: number, width: number = 515, xPos: number = 40, height: number = 16) => {
      doc.rect(xPos, yPos, width, height).fill('#102a43');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff').text(title, xPos + 6, yPos + 4, {
        characterSpacing: 0.5,
      });
    };

    // Helper: page footer
    const drawFooter = (pageNumber: number) => {
      doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');
      doc.text('Ghulam Ghaus — Curriculum Vitae', 40, 795, { width: 300, align: 'left', lineBreak: false });
      doc.text(`Page ${pageNumber} of 2`, 255, 795, { width: 300, align: 'right', lineBreak: false });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 1
    // ═══════════════════════════════════════════════════════════════════════════

    // Top Header: Name on left, Title on right
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#102a43').text(fullName.toUpperCase(), 40, 38);
    const rawHeadline = (content.headline || tailoredCv?.targetRole || 'SOFTWARE ENGINEER').toUpperCase();
    const titleParts = rawHeadline.includes('–')
      ? rawHeadline.split('–').map((p: string) => p.trim())
      : rawHeadline.includes('-')
        ? rawHeadline.split('-').map((p: string) => p.trim())
        : rawHeadline.split(' ');

    if (titleParts.length >= 2) {
      const topTitle = titleParts[0].length > 20 ? titleParts[0].slice(0, 20) : titleParts[0];
      const subTitle = titleParts.slice(1).join(' - ');
      const subTitleClean = subTitle.length > 32 ? subTitle.slice(0, 32) : subTitle;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#102a43').text(topTitle, 260, 36, {
        width: 295,
        align: 'right',
        characterSpacing: 1.2,
      });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#102a43').text(subTitleClean, 260, 50, {
        width: 295,
        align: 'right',
        characterSpacing: 0.8,
      });
    } else {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#102a43').text('SOFTWARE', 355, 36, {
        width: 200,
        align: 'right',
        characterSpacing: 1.5,
      });
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#102a43').text('ENGINEER', 355, 49, {
        width: 200,
        align: 'right',
        characterSpacing: 1.5,
      });
    }

    // Top Divider Line
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(40, 66).lineTo(555, 66).stroke();

    // ── Three-Column Top Info Block ──
    const topBlockY = 74;
    const topBlockHeight = 142;

    // 1. Left Box: CAREER OBJECTIVE
    drawBanner('CAREER OBJECTIVE:', topBlockY, 215, 40, 18);
    doc.rect(40, topBlockY + 18, 215, topBlockHeight - 18).strokeColor('#cbd5e1').lineWidth(0.8).stroke();

    let objectiveText =
      content.summary ||
      'Software Engineer with 4+ years of experience building production backend, full-stack, SaaS, real-time, and AI-integrated applications using Node.js, TypeScript, Python, React/Next.js, PostgreSQL, and cloud technologies. Strong background in REST APIs, microservices, authentication and authorization, WebSockets, payment integrations, AWS/serverless systems, Generative AI, Voice AI, and LLM/API integrations. Seeking a backend or AI engineering role in Saudi Arabia or the UAE.';
    if (!objectiveText.toLowerCase().includes('saudi') && !objectiveText.toLowerCase().includes('uae')) {
      objectiveText += ' Seeking a backend or AI engineering role in Saudi Arabia or the UAE.';
    }

    doc
      .font('Helvetica')
      .fontSize(8.3)
      .fillColor('#1e293b')
      .text(objectiveText, 45, topBlockY + 23, {
        width: 205,
        lineGap: 2.2,
        align: 'justify',
      });

    // 2. Center Box: Contact Details with styled markers
    const centerBlockX = 265;
    const cleanPhone = phone || '+92 306 7956164';
    const cleanLocation = 'Pakistan (Relocation: KSA / UAE)';
    const cleanEmail = email || 'ghulamghaus266@gmail.com';
    const cleanLinkedIn = (linkedin || 'linkedin.com/in/ghulam-ghaus-5b4ba9194/').replace(/^https?:\/\//, '');
    const cleanPortfolio = (portfolio || 'gghaus-portfolio.web.app').replace(/^https?:\/\//, '');

    const contactItems = [
      cleanPhone,
      cleanLocation,
      cleanEmail,
      cleanLinkedIn,
      cleanPortfolio,
    ];

    let contactY = topBlockY + 10;
    for (const text of contactItems) {
      doc.circle(centerBlockX + 4, contactY + 5, 2.5).fill('#102a43');
      doc.font('Helvetica').fontSize(8.3).fillColor('#0f172a').text(text, centerBlockX + 12, contactY + 1, {
        width: 162,
      });
      contactY += 25;
    }

    // 3. Right Box: Photo Frame & Image - Edge to Edge, ZERO Padding
    const photoBoxX = 440;
    const photoBoxY = topBlockY;
    const photoBoxW = 115;
    const photoBoxH = topBlockHeight;

    const photoCandidates = [
      path.resolve(process.cwd(), 'src/assets/profile-photo.jpg'),
      path.resolve(process.cwd(), 'backend/src/assets/profile-photo.jpg'),
      path.resolve(process.cwd(), 'uploads/extracted_profile_1.jpg'),
      path.resolve(process.cwd(), 'backend/uploads/extracted_profile_1.jpg'),
      path.resolve(process.cwd(), '../frontend/public/profile-photo.jpg'),
      path.resolve(process.cwd(), 'frontend/public/profile-photo.jpg'),
    ];
    const photoPath = photoCandidates.find((p) => fs.existsSync(p));
    if (photoPath) {
      try {
        doc.image(photoPath, photoBoxX, photoBoxY, {
          width: photoBoxW,
          height: photoBoxH,
        });
      } catch (e) {
        this.logger.warn(`Could not render profile photo: ${String(e)}`);
      }
    }
    // Border flush right along image edges
    doc.rect(photoBoxX, photoBoxY, photoBoxW, photoBoxH).strokeColor('#0f172a').lineWidth(1).stroke();

    // ── Section: PROFESSIONAL EXPERIENCES: ──
    const expBannerY = 224;
    drawBanner('PROFESSIONAL EXPERIENCES:', expBannerY);

    const defaultExperiences = [
      {
        title: 'Backend / Voice AI Engineer:',
        period: 'Jul 2025 – Aug 2026',
        company: 'Intakely AI (Remote)',
        overview:
          'Intakely AI builds real-time voice AI intake and scheduling automation for live phone conversations, including legal intake workflows.',
        responsibilities: [
          'Engineered a real-time voice intake platform for live phone conversations with sub-second response requirements.',
          'Built Python backend services for bidirectional audio streaming using WebSockets and Twilio Media Streams.',
          'Integrated STT/TTS pipelines (Whisper, Cartesia), interruption handling, and multi-tenant workflows for responsive voice interactions.',
          'Integrated external scheduling services for automated appointment booking and intake workflows.',
        ],
        achievements: [
          'Delivered a live voice agent that handles real phone calls with sub-second response targets.',
          'Designed multi-tenant workflows so multiple clients can run on a single platform.',
        ],
      },
      {
        title: 'Software Engineer:',
        period: 'Sep 2024 – Jun 2025',
        company: 'SOFTOO TECHNOLOGIES Pvt. Ltd – Islamabad, Pakistan',
        overview:
          'Softoo Technologies is a software company with offices in Islamabad, Pakistan and the United Kingdom.',
        responsibilities: [
          'Developed and maintained production SaaS backend services using Node.js and TypeScript.',
          'Designed REST APIs, microservices, and serverless components supporting core business workflows.',
          'Built cloud-based backend components using AWS services including Lambda, API Gateway, and DynamoDB.',
          'Optimized data-access patterns for improved performance and reliability.',
        ],
        achievements: [
          'Delivered serverless AWS backend components supporting core business workflows in production.',
          'Improved performance and reliability of data access in production SaaS services.',
        ],
      },
      {
        title: 'Software Engineer (Node):',
        period: 'Aug 2022 – Aug 2024',
        company: 'HiveWorx Private Limited – Islamabad, Pakistan',
        overview:
          'HiveWorx is a software company based in Islamabad, Pakistan, building enterprise applications.',
        responsibilities: [
          'Built enterprise backend systems using Node.js, Express.js, NestJS, PostgreSQL, and TypeORM.',
          'Implemented OAuth2, JWT authentication, RBAC, and secure authorization workflows.',
          'Built real-time notification systems using WebSockets and automated background processes.',
        ],
        achievements: [
          'Led development of a centralized User Management and SSO platform shared across multiple enterprise applications.',
          'Formally recommended by the company in the experience letter for future positions.',
        ],
      },
    ];

    const experiencesList =
      content.experiences && content.experiences.length > 0
        ? content.experiences.slice(0, 3).map((exp, idx) => {
            const canonical =
              defaultExperiences.find(
                (c) =>
                  c.company.toLowerCase().includes(exp.company.toLowerCase()) ||
                  exp.company.toLowerCase().includes(c.company.toLowerCase().slice(0, 6)),
              ) || defaultExperiences[idx] || defaultExperiences[0];

            const bullets =
              exp.bullets && exp.bullets.length > 0 ? exp.bullets : canonical.responsibilities;
            const resp = bullets.length > 2 ? bullets.slice(0, bullets.length - 1) : bullets;
            const ach =
              bullets.length > 2 ? bullets.slice(bullets.length - 1) : canonical.achievements;

            return {
              title: exp.title.endsWith(':') ? exp.title : `${exp.title}:`,
              period: exp.period || canonical.period,
              company: exp.company || canonical.company,
              overview: canonical.overview,
              responsibilities: resp,
              achievements: ach,
            };
          })
        : defaultExperiences;

    let curExpY = 246;
    for (const exp of experiencesList) {
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(exp.title, 40, curExpY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(exp.period, 355, curExpY, {
        width: 200,
        align: 'right',
      });
      curExpY += 13;

      doc.font('Helvetica-Bold').fontSize(8.8).fillColor('#102a43').text(exp.company, 40, curExpY);
      curExpY += 11;

      doc.font('Helvetica').fontSize(8).fillColor('#475569').text(exp.overview, 40, curExpY, { width: 515 });
      curExpY += 12;

      doc.font('Helvetica-Bold').fontSize(8.4).fillColor('#0f172a').text('Responsibilities:', 40, curExpY, { underline: true });
      curExpY += 10;

      for (const bullet of exp.responsibilities) {
        doc.font('Helvetica').fontSize(8.2).fillColor('#1e293b').text(`•  ${bullet}`, 46, curExpY, {
          width: 505,
          lineGap: 1.6,
        });
        curExpY = doc.y + 2;
      }

      doc.font('Helvetica-Bold').fontSize(8.4).fillColor('#0f172a').text('Achievements:', 40, curExpY, { underline: true });
      curExpY += 10;

      for (const ach of exp.achievements) {
        doc.font('Helvetica').fontSize(8.2).fillColor('#1e293b').text(`•  ${ach}`, 46, curExpY, {
          width: 505,
          lineGap: 1.6,
        });
        curExpY = doc.y + 2;
      }

      curExpY += 6;
    }

    const defaultProjects = [
      {
        title: 'Real-Time Voice Intake Platform:',
        description:
          'Multi-tenant voice automation platform for live legal intake and automated appointment scheduling with sub-second latency and automated call routing.',
        techStack: 'Python, WebSockets, Twilio Media Streams, Whisper STT, Cartesia TTS, Supabase, Docker.',
      },
      {
        title: 'Virtual Hospital System (Saudi Client):',
        description:
          'Comprehensive healthcare platform facilitating secure physician-patient communication, appointment scheduling, electronic records, and real-time virtual consultations.',
        techStack: 'Node.js, NestJS, PostgreSQL, WebSockets, Redis, WebRTC, AWS.',
      },
      {
        title: 'Esports Event Management Platform:',
        description:
          'Full-stack tournament platform handling tournament brackets, player profiles, squad rosters, payment gateway integrations, registrations, and live scoring.',
        techStack: 'Next.js, React, Node.js, Express, PostgreSQL, TailwindCSS.',
      },
    ];

    const projectsList =
      content.projects && content.projects.length > 0
        ? content.projects.slice(0, 3).map((p) => ({
            title: p.title.endsWith(':') ? p.title : `${p.title}:`,
            description: p.description,
            techStack:
              p.techStack && p.techStack.length > 0
                ? p.techStack.join(', ')
                : 'Python, Node.js, WebSockets, LLM, Supabase',
          }))
        : defaultProjects;

    // ── Seamless Page 1 Utilization: Start Key Engineering Projects on Page 1 ──
    const proj1 = projectsList[0];
    if (proj1 && curExpY < 720) {
      const projBannerY = curExpY + 4;
      drawBanner('KEY ENGINEERING & AI PROJECTS:', projBannerY);
      let p1Y = projBannerY + 22;

      doc.font('Helvetica-Bold').fontSize(8.8).fillColor('#0f172a').text(`• ${proj1.title} `, 40, p1Y, {
        continued: true,
      });
      doc.font('Helvetica').fontSize(8.2).fillColor('#334155').text(proj1.description, { width: 515, lineGap: 1.5 });
      p1Y = doc.y + 3;

      doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#102a43').text('Tech Stack: ', 48, p1Y, {
        continued: true,
      });
      doc.font('Helvetica').fontSize(7.8).fillColor('#475569').text(proj1.techStack, { width: 500 });
    }

    drawFooter(1);

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 2
    // ═══════════════════════════════════════════════════════════════════════════
    doc.addPage();

    // Top Header
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#102a43').text(fullName.toUpperCase(), 40, 36);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#102a43').text('SOFTWARE ENGINEER', 355, 39, {
      width: 200,
      align: 'right',
      characterSpacing: 1.5,
    });
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(40, 52).lineTo(555, 52).stroke();

    // ── 1. Continue Projects on Page 2 ──
    let page2Y = 60;
    const remainingProjects = projectsList.slice(1);
    if (remainingProjects.length > 0) {
      drawBanner('KEY ENGINEERING & AI PROJECTS (CONTINUED):', page2Y);
      page2Y += 21;

      for (const proj of remainingProjects) {
        doc.font('Helvetica-Bold').fontSize(8.8).fillColor('#0f172a').text(`• ${proj.title} `, 40, page2Y, {
          continued: true,
        });
        doc.font('Helvetica').fontSize(8.2).fillColor('#334155').text(proj.description, { width: 515, lineGap: 1.5 });
        page2Y = doc.y + 2;

        doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#102a43').text('Tech Stack: ', 48, page2Y, {
          continued: true,
        });
        doc.font('Helvetica').fontSize(7.8).fillColor('#475569').text(proj.techStack, { width: 500 });
        page2Y = doc.y + 6;
      }
    } else {
      drawBanner('KEY ENGINEERING & AI PROJECTS:', page2Y);
      page2Y += 21;
    }



    // ── 2. EDUCATIONAL CREDENTIALS ──
    page2Y += 2;
    drawBanner('EDUCATIONAL CREDENTIALS:', page2Y);
    page2Y += 19;

    const eduCols = [
      { text: 'DEGREE / CERTIFICATION', width: 195 },
      { text: 'UNIVERSITY / INSTITUTE', width: 240 },
      { text: 'YEAR OF PASSING', width: 80, align: 'center' as const },
    ];

    const drawGridRow = (
      y: number,
      cols: Array<{ text: string; boldPrefix?: string; width: number; align?: 'left' | 'center' | 'right' }>,
      height: number,
      isHeader = false,
    ) => {
      let curX = 40;
      for (const col of cols) {
        if (isHeader) {
          doc.rect(curX, y, col.width, height).fillAndStroke('#f1f5f9', '#cbd5e1');
          doc.font('Helvetica-Bold').fontSize(7).fillColor('#102a43');
          doc.text(col.text, curX + 4, y + 4, { width: col.width - 8, align: col.align || 'left' });
        } else {
          doc.rect(curX, y, col.width, height).strokeColor('#cbd5e1').lineWidth(0.6).stroke();
          const textX = curX + 4;
          const textY = y + 3.5;
          if (col.boldPrefix) {
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
            doc.text(col.boldPrefix, textX, textY, { continued: true });
            doc.font('Helvetica').fontSize(7).fillColor('#334155');
            doc.text(` ${col.text}`, { width: col.width - 8 });
          } else {
            doc.font('Helvetica').fontSize(7).fillColor('#1e293b');
            doc.text(col.text, textX, textY, { width: col.width - 8, align: col.align || 'left' });
          }
        }
        curX += col.width;
      }
    };

    drawGridRow(page2Y, eduCols, 14, true);
    page2Y += 14;

    const eduRows = [
      {
        cols: [
          { text: 'BS Information Technology (CGPA 3.28 / 4.00)', width: 195 },
          { text: 'Government College University Faisalabad', width: 240 },
          { text: '2019', width: 80, align: 'center' as const },
        ],
      },
      {
        cols: [
          { text: 'Certificate in Block Chain Programming (Grade A)', width: 195 },
          { text: 'NAVTTC / Air University, Islamabad', width: 240 },
          { text: '2022', width: 80, align: 'center' as const },
        ],
      },
      {
        cols: [
          { text: 'Intermediate (FSc Pre-Engineering)', width: 195 },
          { text: 'Government Degree College Lathianwala', width: 240 },
          { text: '2014', width: 80, align: 'center' as const },
        ],
      },
      {
        cols: [
          { text: 'Matriculation (Science)', width: 195 },
          { text: 'Government Higher Secondary School Khurrianwala', width: 240 },
          { text: '2012', width: 80, align: 'center' as const },
        ],
      },
    ];

    for (const r of eduRows) {
      drawGridRow(page2Y, r.cols, 14);
      page2Y += 14;
    }

    // ── 3. PROFESSIONAL & TECHNICAL SKILLS ──
    page2Y += 8;
    drawBanner('PROFESSIONAL & TECHNICAL SKILLS:', page2Y);
    page2Y += 19;

    const skillWidth = 515 / 3;
    const skillRows = [
      [
        { boldPrefix: 'Backend:', text: 'Node.js, Express.js, NestJS', width: skillWidth },
        { boldPrefix: 'Languages:', text: 'TypeScript, JavaScript, Python', width: skillWidth },
        { boldPrefix: 'Frameworks:', text: 'FastAPI, Python AsyncIO', width: skillWidth },
      ],
      [
        { boldPrefix: 'Frontend:', text: 'React.js, Next.js, HTML5/CSS3', width: skillWidth },
        { boldPrefix: 'Architecture:', text: 'REST APIs, Microservices, Event-Driven', width: skillWidth },
        { boldPrefix: 'Real-Time:', text: 'WebSockets, Twilio Media Streams', width: skillWidth },
      ],
      [
        { boldPrefix: 'Databases:', text: 'PostgreSQL, MySQL, Supabase', width: skillWidth },
        { boldPrefix: 'NoSQL:', text: 'MongoDB, DynamoDB, Redis', width: skillWidth },
        { boldPrefix: 'DevOps / Tools:', text: 'Docker, Git, GitHub, Jira, Postman', width: skillWidth },
      ],
      [
        { boldPrefix: 'Cloud / AWS:', text: 'AWS Lambda, API Gateway, S3, Cognito', width: skillWidth },
        { boldPrefix: 'Security:', text: 'OAuth2, JWT, RBAC, SSO', width: skillWidth },
        { boldPrefix: 'Testing / Docs:', text: 'Swagger / OpenAPI, Jest, Unit Testing', width: skillWidth },
      ],
      [
        { boldPrefix: 'AI Engineering:', text: 'Generative AI, AI Agents, LLM APIs', width: skillWidth },
        { boldPrefix: 'Voice AI:', text: 'STT / TTS (Whisper, Cartesia)', width: skillWidth },
        { boldPrefix: 'Integrations:', text: 'Third-party APIs, Webhooks, Payments', width: skillWidth },
      ],
    ];

    for (const sRow of skillRows) {
      drawGridRow(page2Y, sRow, 19);
      page2Y += 19;
    }

    // ── 4. LANGUAGES ──
    page2Y += 8;
    drawBanner('LANGUAGES:', page2Y);
    page2Y += 19;

    const langWidth = 515 / 2;
    drawGridRow(
      page2Y,
      [
        { text: 'English: Professional Proficiency (Working / Technical)', width: langWidth, align: 'center' },
        { text: 'Urdu: Native / Bilingual', width: langWidth, align: 'center' },
      ],
      15,
    );
    page2Y += 23;

    // ── 5. CURRICULAR ACTIVITIES ──
    drawBanner('CURRICULAR ACTIVITIES:', page2Y);
    page2Y += 19;

    const actWidth = 515 / 3;
    drawGridRow(
      page2Y,
      [
        { text: 'Cricket', width: actWidth, align: 'center' },
        { text: 'Fishing', width: actWidth, align: 'center' },
        { text: 'Badminton', width: actWidth, align: 'center' },
      ],
      15,
    );
    page2Y += 23;

    // ── 6. REFERENCE ──
    drawBanner('REFERENCE:', page2Y);
    page2Y += 19;

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#334155')
      .text(
        'To be furnished upon request. Experience letters, degree verifications, and Saudi / UAE attested documents available on request.',
        40,
        page2Y,
        { width: 515 },
      );

    drawFooter(2);
  }

  private renderEuropeanCvPdf(
    doc: PDFKit.PDFDocument,
    data: {
      content: z.infer<typeof TailoredCvContentSchema>;
      tailoredCv: any;
      fullName: string;
      email: string;
      phone: string;
      location: string;
      linkedin: string;
      github: string;
      portfolio: string;
      languageText?: string;
    },
  ) {
    const { content, tailoredCv, fullName, email, phone, location, linkedin, github, portfolio, languageText } = data;

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

    doc.moveDown(0.6);
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.6);

    const addSectionHeading = (title: string) => {
      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e1b4b').text(title.toUpperCase(), {
        characterSpacing: 0.5,
      });
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).stroke();
      doc.moveDown(0.4);
    };

    if (content.summary) {
      addSectionHeading('Professional Summary');
      doc.font('Helvetica').fontSize(9.5).fillColor('#1e293b').lineGap(2).text(content.summary, {
        align: 'justify',
      });
      doc.moveDown(0.4);
    }

    if (content.skills && content.skills.length > 0) {
      addSectionHeading('Core Technical Competencies');
      for (const grp of content.skills) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(`${grp.category}: `, { continued: true });
        doc.font('Helvetica').fontSize(9).fillColor('#334155').text(grp.items.join(', '));
        doc.moveDown(0.15);
      }
      doc.moveDown(0.4);
    }

    if (content.experiences && content.experiences.length > 0) {
      addSectionHeading('Professional Experience');
      for (const exp of content.experiences) {
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

    if (languageText) {
      if (doc.y > 700) doc.addPage();
      addSectionHeading('Languages');
      doc.font('Helvetica').fontSize(9).fillColor('#334155').text(languageText);
    }
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

    const [profile, skills, experiences, projects, user] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.skill.findMany({ where: { userId } }),
      this.prisma.experience.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
      this.prisma.project.findMany({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);

    const inputHash = createHash('sha256')
      .update(`${userId}::cover::${opp.id}::${opp.title}::${skills.length}::${projects.length}`)
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
      `Verified Projects:`,
      ...projects.map(
        (p) =>
          `  - ${p.title}: ${p.description || ''} (Tech: ${JSON.stringify(p.techStack)})`,
      ),
    ].join('\n');

    const prompt = `CANDIDATE MASTER PROFILE (Ground Truth Only):\n${candidateProfileText}\n\nJOB DETAILS:\nRole: ${opp.title || 'Software Engineer'}\nCompany: ${opp.company || 'Company'}\nLocation: ${opp.country || ''}\nJob Requirements:\n${opp.rawText.slice(0, 2500)}\n\nTask: Write an outstanding, tailored cover letter.
RULES:
1. Every qualification, metric, tool, and company MUST be strictly true to candidate profile.
2. Hook the employer immediately with 1-2 relevant project completions from the candidate's verified projects list that solve problems directly related to this JD.
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
