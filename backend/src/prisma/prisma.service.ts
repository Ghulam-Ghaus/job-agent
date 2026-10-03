import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    this.client = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
  }

  // Expose all Prisma model accessors via delegation
  get user() { return this.client.user; }
  get session() { return this.client.session; }
  get auditLog() { return this.client.auditLog; }
  get setting() { return this.client.setting; }

  // Sprint 1 — profile & sub-resources
  get profile() { return this.client.profile; }
  get experience() { return this.client.experience; }
  get skill() { return this.client.skill; }
  get project() { return this.client.project; }
  get cv() { return this.client.cv; }
  get answerBankItem() { return this.client.answerBankItem; }
  get jobPreference() { return this.client.jobPreference; }
  get opportunity() { return this.client.opportunity; }
  get opportunityRequirement() { return this.client.opportunityRequirement; }
  get opportunityMatch() { return this.client.opportunityMatch; }
  get llmCall() { return this.client.llmCall; }
  get notification() { return this.client.notification; }

  // Sprint 2 — apply packs & approvals
  get applyPack() { return this.client.applyPack; }
  get approvalRecord() { return this.client.approvalRecord; }

  // Sprint 4 — direct clients & leads
  get company() { return this.client.company; }
  get contact() { return this.client.contact; }
  get outreachMessage() { return this.client.outreachMessage; }
  get suppressionEntry() { return this.client.suppressionEntry; }

  // Sprint 5 — products & showcase
  get product() { return this.client.product; }

  // Sprint 6 — career assets (tailored CV, cover letter, interview prep)
  get tailoredCv() { return this.client.tailoredCv; }
  get coverLetter() { return this.client.coverLetter; }
  get interviewPrep() { return this.client.interviewPrep; }

  /** Run raw SQL — used by health check and migrations helpers */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $queryRaw(...args: Parameters<PrismaClient['$queryRaw']>): Promise<any> {
    return this.client.$queryRaw(...args);
  }

  $transaction(...args: Parameters<PrismaClient['$transaction']>): ReturnType<PrismaClient['$transaction']> {
    return this.client.$transaction(...args) as ReturnType<PrismaClient['$transaction']>;
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('Prisma connected to database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }
}
