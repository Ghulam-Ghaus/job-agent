import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InterviewPrepService } from './interview-prep.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LlmService } from '../llm/llm.service.js';

describe('InterviewPrepService', () => {
  let service: InterviewPrepService;
  let prismaMock: any;
  let llmServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      profile: {
        findUnique: vi.fn().mockResolvedValue({
          fullName: 'Ghulam Ghaus',
          headline: 'Senior Full Stack Engineer',
        }),
      },
      skill: {
        findMany: vi.fn().mockResolvedValue([
          { name: 'NestJS', level: 'EXPERT' },
          { name: 'PostgreSQL', level: 'EXPERT' },
        ]),
      },
      experience: {
        findMany: vi.fn().mockResolvedValue([
          { title: 'Backend Lead', company: 'SoftTech', techStack: ['NestJS'] },
        ]),
      },
      opportunity: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'opp-1',
          title: 'Senior Backend Engineer',
          company: 'Dubai Holding',
          rawText: 'Looking for a Senior Backend Engineer...',
          match: {
            gapsJson: [{ skill: 'Kubernetes', reason: 'Not found in profile' }],
          },
        }),
      },
      interviewPrep: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'prep-1', ...data })),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'prep-1', ...data })),
        findMany: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue({ id: 'prep-1' }),
      },
    };

    llmServiceMock = {
      generateStructured: vi.fn().mockResolvedValue({
        overview: 'Comprehensive prep for Senior Backend Engineer',
        topics: [
          {
            name: 'System Design & Scalability',
            description: 'Core concepts for handling heavy throughput',
            keyConcepts: ['Horizontal scaling', 'Idempotency', 'Caching with Redis'],
          },
        ],
        tasks: [
          {
            title: 'Design an Idempotent Payment Webhook',
            description: 'Implement distributed locking with Redis',
            topic: 'System Design',
            difficulty: 'MEDIUM',
          },
        ],
        questions: [
          {
            question: 'How do you handle race conditions in database transactions?',
            category: 'Database & Concurrency',
            expectedAnswer: 'Use pessimistic locking or serializable isolation level...',
            talkingPoints: ['SELECT FOR UPDATE', 'ACID guarantees'],
          },
        ],
        gapBridges: [
          {
            technology: 'Kubernetes',
            challenge: 'Candidate has Docker/ECS but not k8s',
            bridgingAnswer: 'Emphasize deep container orchestration principles...',
          },
        ],
        questionsToAsk: [
          {
            question: 'What does your team deployment frequency look like?',
            strategicPurpose: 'Demonstrates focus on developer productivity and CI/CD maturity.',
          },
        ],
      }),
    };

    service = new InterviewPrepService(
      prismaMock as unknown as PrismaService,
      llmServiceMock as unknown as LlmService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate an interview prep plan and format tasks with checkboxes', async () => {
    const res = await service.generatePrep('user-1', {
      opportunityId: 'opp-1',
      targetRole: 'Senior Backend Engineer',
    });

    expect(res).toBeDefined();
    expect(res.targetRole).toBe('Senior Backend Engineer');
    expect(res.tasksJson).toHaveLength(1);
    expect((res.tasksJson as Array<{ done: boolean }>)[0].done).toBe(false);
  });

  it('should toggle task completion', async () => {
    prismaMock.interviewPrep.findFirst = vi.fn().mockResolvedValue({
      id: 'prep-1',
      tasksJson: [
        { id: 'task-1', title: 'Practice SQL', done: false },
      ],
    });

    const res = await service.toggleTask('prep-1', 'task-1', 'user-1', { done: true });
    expect(res.success).toBe(true);
    expect(res.done).toBe(true);
    expect(res.progressPercent).toBe(100);
    expect(prismaMock.interviewPrep.update).toHaveBeenCalled();
  });
});
