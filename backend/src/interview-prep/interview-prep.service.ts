import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { LlmService } from '../llm/llm.service.js';
import {
  GenerateInterviewPrepDto,
  InterviewCoachDto,
  ToggleTaskDto,
} from './dto/create-interview-prep.dto.js';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const CoachedAnswerSchema = z.object({
  answer: z.string().describe(
    'The spoken answer in natural, simple, and professional English. Structured into 2-3 concise paragraphs or bulleted sections. NOT too long like an essay, and NOT a single-word answer. Professional, direct, and conversational.',
  ),
  keyTalkingPoints: z.array(z.string()).describe(
    '3-4 crisp talking points or phrases the candidate should verbally hit',
  ),
  speakingDurationSec: z.number().describe(
    'Estimated speaking duration in seconds (typically 30-75 seconds)',
  ),
  profileConnection: z.string().describe(
    'Brief 1-sentence note showing which real experience from the profile was highlighted, or an honest gap bridge if external technology',
  ),
  modeApplied: z.string().describe(
    'The mode applied: standard, short, deep_technical, simple_english, or bullet_points',
  ),
});

export type CoachedAnswer = z.infer<typeof CoachedAnswerSchema>;

const InterviewPrepPlanSchema = z.object({
  overview: z.string().describe('High-level preparation strategy and expectations for this interview'),
  topics: z.array(
    z.object({
      name: z.string().describe('Core subject area, e.g., System Design, SQL Performance, NestJS Architecture'),
      description: z.string().describe('Why this matters for the role'),
      keyConcepts: z.array(z.string()).describe('Core keywords and design patterns to master'),
    }),
  ),
  tasks: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string().describe('Actionable, hands-on prep exercise (e.g. Design an idempotency key middleware)'),
      description: z.string().describe('Step-by-step guidance on how to practice or implement this'),
      topic: z.string(),
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    }),
  ),
  questions: z.array(
    z.object({
      question: z.string().describe('Realistic technical or scenario interview question'),
      category: z.string(),
      expectedAnswer: z.string().describe('Structured model answer grounded in verified best practices'),
      talkingPoints: z.array(z.string()).describe('Bullet phrases the candidate should verbally highlight'),
    }),
  ),
  gapBridges: z.array(
    z.object({
      technology: z.string().describe('Technology or skill that might be unfamiliar or a gap'),
      challenge: z.string().describe('Typical interview trap or question around this tech'),
      bridgingAnswer: z.string().describe('How to answer truthfully while relating to existing strengths'),
    }),
  ),
  questionsToAsk: z.array(
    z.object({
      question: z.string().describe('High-signal consultative question for the candidate to ask interviewers'),
      strategicPurpose: z.string().describe('Why this demonstrates senior-level commercial acumen'),
    }),
  ),
});

export interface PrepTask {
  id: string;
  title: string;
  description: string;
  topic: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  done: boolean;
}

@Injectable()
export class InterviewPrepService {
  private readonly logger = new Logger(InterviewPrepService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async generatePrep(userId: string, dto: GenerateInterviewPrepDto) {
    // 1. Gather profile and skill gaps context
    const [profile, skills, experiences] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.skill.findMany({ where: { userId } }),
      this.prisma.experience.findMany({
        where: { userId },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    let targetRole = dto.targetRole || 'Software Engineer';
    let companyName = 'Target Employer';
    let jobDescription = dto.jobDescription || '';
    let skillGapsText = '';

    if (dto.opportunityId) {
      const opp = await this.prisma.opportunity.findFirst({
        where: { id: dto.opportunityId, userId },
        include: { requirement: true, match: true },
      });
      if (opp) {
        targetRole = opp.title || targetRole;
        companyName = opp.company || companyName;
        jobDescription = opp.rawText || '';

        const gaps = (opp.match?.gapsJson as Array<{ skill?: string; reason?: string }>) || [];
        if (gaps.length > 0) {
          skillGapsText = gaps.map((g) => `Gap: ${g.skill} - ${g.reason}`).join('\n');
        }
      }
    }

    // 2. Input hash for caching
    const confirmedSkills = skills.map((s) => s.name).sort().join(',');
    const inputHash = createHash('sha256')
      .update(`${userId}::prep::${targetRole}::${companyName}::${confirmedSkills.slice(0, 300)}::${jobDescription.slice(0, 500)}`)
      .digest('hex');

    if (!dto.forceRegenerate) {
      const cached = await this.prisma.interviewPrep.findFirst({
        where: { userId, inputHash },
        orderBy: { createdAt: 'desc' },
      });
      if (cached) {
        this.logger.log(`Returning cached InterviewPrep ${cached.id} for user ${userId}`);
        return cached;
      }
    }

    // 3. Prompt construction
    const candidateContext = [
      `Headline: ${profile?.headline || targetRole}`,
      `Verified Skills: ${skills.map((s) => `${s.name} (${s.level})`).join(', ')}`,
      `Past Positions:`,
      ...experiences.slice(0, 4).map((e) => `  - ${e.title} at ${e.company} (${JSON.stringify(e.techStack)})`),
      skillGapsText ? `Identified Skill Gaps for this Role:\n${skillGapsText}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `CANDIDATE PROFILE (Ground Truth):\n${candidateContext}\n\nTARGET ROLE: ${targetRole}\nCOMPANY: ${companyName}\n${
      jobDescription ? `JOB DESCRIPTION:\n${jobDescription.slice(0, 3000)}\n\n` : ''
    }${dto.focusAreas?.length ? `USER-REQUESTED FOCUS AREAS:\n${dto.focusAreas.join(', ')}\n\n` : ''}Task: Build an exhaustive, interactive interview preparation and learning plan.
REQUIREMENTS:
1. Provide 4-6 focused learning topics with core concepts.
2. Provide 6-8 practical, hands-on tasks that the candidate can practice writing or designing.
3. Provide 5-8 realistic technical and architectural questions with model answers.
4. If there are skill gaps, provide 2-4 "gap bridge" scripts: how to acknowledge unfamiliar tools while connecting to proven skills.
5. Provide 3-5 sharp, consultative questions for the candidate to ask the interviewer.`;

    const generated = await this.llm.generateStructured({
      system:
        'You are a premier technical interview coach and principal software architect. You design rigorous, realistic interview prep plans that help engineers master interview topics, practice essential tasks, and bridge skill gaps honestly.',
      prompt,
      schema: InterviewPrepPlanSchema,
      purpose: 'interview_prep_generation',
      userId,
    });

    // 4. Format initial tasks with IDs and done=false
    const tasks: PrepTask[] = generated.tasks.map((t, idx) => ({
      id: t.id || `task_${idx + 1}_${randomUUID().slice(0, 6)}`,
      title: t.title,
      description: t.description,
      topic: t.topic,
      difficulty: t.difficulty,
      done: false,
    }));

    // 5. Store record
    return this.prisma.interviewPrep.create({
      data: {
        userId,
        opportunityId: dto.opportunityId,
        targetRole,
        inputHash,
        planJson: generated,
        tasksJson: tasks as unknown as Prisma.InputJsonValue,
        promptVersion: 'v1',
      },
    });
  }

  async getPrep(id: string, userId: string) {
    const prep = await this.prisma.interviewPrep.findFirst({
      where: { id, userId },
      include: { opportunity: true },
    });
    if (!prep) throw new NotFoundException('Interview prep plan not found');
    return prep;
  }

  async listPreps(userId: string, opportunityId?: string) {
    return this.prisma.interviewPrep.findMany({
      where: {
        userId,
        ...(opportunityId ? { opportunityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        opportunity: {
          select: { id: true, title: true, company: true },
        },
      },
    });
  }

  async toggleTask(id: string, taskId: string, userId: string, dto: ToggleTaskDto) {
    const prep = await this.getPrep(id, userId);
    const tasks = (prep.tasksJson as unknown as PrepTask[]) || [];

    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      throw new NotFoundException(`Task "${taskId}" not found in this prep plan`);
    }

    const currentDone = tasks[taskIndex].done;
    const newDone = dto.done !== undefined ? dto.done : !currentDone;
    tasks[taskIndex].done = newDone;

    const updated = await this.prisma.interviewPrep.update({
      where: { id: prep.id },
      data: { tasksJson: tasks as unknown as Prisma.InputJsonValue },
    });

    const completedCount = tasks.filter((t) => t.done).length;
    const progressPercent = Math.round((completedCount / tasks.length) * 100);

    return {
      success: true,
      taskId,
      done: newDone,
      completedCount,
      totalCount: tasks.length,
      progressPercent,
      prep: updated,
    };
  }

  async deletePrep(id: string, userId: string) {
    const prep = await this.getPrep(id, userId);
    return this.prisma.interviewPrep.delete({ where: { id: prep.id } });
  }

  async coachAnswer(userId: string, dto: InterviewCoachDto): Promise<CoachedAnswer> {
    const [profile, skills, experiences, projects] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.skill.findMany({ where: { userId } }),
      this.prisma.experience.findMany({
        where: { userId },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.project.findMany({
        where: { userId },
        take: 8,
      }),
    ]);

    const targetRole = dto.targetRole || profile?.headline || 'Backend & AI Engineer';
    const mode = dto.mode || 'standard';

    // Candidate ground truth context
    const candidateContext = [
      `Name: ${profile?.fullName || 'Ghulam Ghaus'}`,
      `Headline: ${profile?.headline || targetRole}`,
      `Verified Skills: ${skills.map((s) => `${s.name} (${s.level})`).join(', ')}`,
      `Key Past Experiences:`,
      ...experiences.map(
        (e) => `  - ${e.title} at ${e.company} (${JSON.stringify(e.techStack)}): ${Array.isArray(e.bullets) ? (e.bullets as string[]).slice(0, 3).join('; ') : ''}`,
      ),
      `Featured Projects:`,
      ...projects.map(
        (p) => `  - ${p.title} (${JSON.stringify(p.techStack)}): ${p.description || ''}`,
      ),
    ].join('\n');

    let modeInstruction = '';
    switch (mode) {
      case 'short':
        modeInstruction = 'SHORT 30-SECOND PITCH MODE: Keep the answer strictly between 60 and 90 words. 1-2 punchy sentences capturing the core concept and candidate proof point. Direct, verbal, high-impact.';
        break;
      case 'deep_technical':
        modeInstruction = 'DEEP TECHNICAL ARCHITECTURE MODE: Provide 140-190 words. Detail underlying architecture mechanics, trade-offs (e.g. latency vs consistency, stateful vs stateless), and exact technical patterns. Structured and crisp.';
        break;
      case 'simple_english':
        modeInstruction = 'SIMPLE NATURAL ENGLISH MODE: Provide 100-140 words in clear, everyday conversational language. Avoid unnecessary jargon, use clear analogies, and make it sound natural and effortless when spoken.';
        break;
      case 'bullet_points':
        modeInstruction = 'BULLET POINTS ONLY MODE: Format the answer into 3-4 structured bullet points with bold keywords, ideal for quick talking notes.';
        break;
      case 'standard':
      default:
        modeInstruction = 'STANDARD INTERVIEW MODE: Provide a balanced 110-160 word answer (~45-60 seconds speaking time). Structure: (1) Direct definition/high-level concept in simple English, (2) Architectural implementation or trade-offs, (3) Real-world grounding from candidate experience (or honest bridge).';
        break;
    }

    const refinementContext = [
      dto.previousAnswer ? `PREVIOUS DRAFT ANSWER:\n${dto.previousAnswer}\n` : '',
      dto.comment ? `USER REFINEMENT INSTRUCTION / COMMENT:\n"${dto.comment}"\n(CRITICAL: Modify and adjust the answer specifically addressing this instruction!)\n` : '',
    ].filter(Boolean).join('\n');

    const prompt = `CANDIDATE GROUND TRUTH PROFILE:
${candidateContext}

INTERVIEW QUESTION TO ANSWER:
"${dto.question}"

TARGET ROLE: ${targetRole}
SELECTED MODE: ${mode}

${modeInstruction}

${refinementContext}
STRICT REQUIREMENTS:
1. STRUCTURE & LENGTH: Structured, simple, natural spoken English. NEVER write an essay, and NEVER give a single-word or superficial answer. Make it sound like an articulate, senior engineer speaking calmly in an interview.
2. GROUNDING & HONESTY: If the question touches tools in candidate profile (e.g. NestJS, Python, Twilio, WebSockets, FSM, AWS Lambda, DynamoDB, Docker, OAuth2/JWT), weave in a real concrete experience. If the question asks about a technology or concept outside the profile (e.g. Kubernetes, Kafka, Go), explain it accurately and give an honest bridge without pretending to have worked with it in production.
3. If user feedback/comment is provided, adapt to it immediately.
4. Estimate realistic verbal speaking duration in seconds.`;

    const generated = await this.llm.generateStructured({
      system:
        'You are a premier technical interview coach and principal software architect. You prepare senior engineers to deliver clear, structured, and spoken interview answers in natural, simple, and professional English.',
      prompt,
      schema: CoachedAnswerSchema,
      purpose: 'interview_coach_answer',
      userId,
    });

    return generated;
  }
}

