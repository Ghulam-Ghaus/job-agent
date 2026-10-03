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
  ToggleTaskDto,
} from './dto/create-interview-prep.dto.js';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

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
}
