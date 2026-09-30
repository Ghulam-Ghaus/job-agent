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
