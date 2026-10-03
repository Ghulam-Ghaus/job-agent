import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';
import { PipelineService } from '../../queues/pipeline/pipeline.service.js';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue(''),
          },
        },
        {
          provide: PipelineService,
          useValue: {
            addJob: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should parse Upwork job alert email and enqueue as FREELANCE', async () => {
    const pipeline = service['pipeline'] as unknown as { addJob: ReturnType<typeof vi.fn> };
    const fakeMail: any = {
      from: { value: [{ address: 'donotreply@upwork.com' }] },
      subject: '[Upwork] Job Alert: Senior NestJS & Next.js Full Stack Architect',
      date: new Date('2026-10-01T12:00:00Z'),
      text: `
        Job Title: Senior NestJS & Next.js Full Stack Architect
        Hourly: $50.00 - $85.00/hr
        Payment verified - Rating 4.95 of 5 stars - $60k+ spent - United States
        Proposals: Less than 5
        Skills: NestJS, Next.js, PostgreSQL, TypeScript, Redis
        We need a high-end engineer to build our agentic workflow automation pipeline.
        https://www.upwork.com/jobs/~01abc123456789
      `,
      html: '<p><a href="https://www.upwork.com/jobs/~01abc123456789">View job</a></p>',
    };

    const count = await service['parseAndEnqueue'](fakeMail, 'user-123');
    expect(count).toBe(1);
    expect(pipeline.addJob).toHaveBeenCalledTimes(1);
    const jobArg = pipeline.addJob.mock.calls[0][0];
    expect(jobArg.type).toBe('FREELANCE');
    expect(jobArg.url).toBe('https://www.upwork.com/jobs/~01abc123456789');
    expect(jobArg.rawText).toContain('Hourly: $50.00 - $85.00/hr');
    expect(jobArg.rawText).toContain('Payment verified: Yes');
    expect(jobArg.rawText).toContain('Less than 5 proposals');
  });
});
