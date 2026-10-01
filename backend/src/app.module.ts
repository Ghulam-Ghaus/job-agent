import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';
import { validate } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { ExperienceModule } from './experience/experience.module.js';
import { SkillsModule } from './skills/skills.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { CvsModule } from './cvs/cvs.module.js';
import { AnswerBankModule } from './answer-bank/answer-bank.module.js';
import { PreferencesModule } from './preferences/preferences.module.js';
import { OpportunitiesModule } from './opportunities/opportunities.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UploadModule } from './upload/upload.module.js';
import { LlmModule } from './llm/llm.module.js';

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      cache: true,
    }),

    // ── Logging ─────────────────────────────────────────────────────────────
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.passwordHash',
          'req.body.refreshToken',
        ],
        customProps: (req: { requestId?: string }) => ({
          requestId: req.requestId,
        }),
      },
    }),

    // ── Rate Limiting ────────────────────────────────────────────────────────
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1000, limit: 10 },
        { name: 'long', ttl: 60_000, limit: 100 },
      ],
    }),

    // ── Health ───────────────────────────────────────────────────────────────
    TerminusModule,

    // ── Database ─────────────────────────────────────────────────────────────
    PrismaModule,

    AuthModule,

    ProfileModule,

    ExperienceModule,

    SkillsModule,

    ProjectsModule,

    CvsModule,

    AnswerBankModule,

    PreferencesModule,

    OpportunitiesModule,

    StorageModule,

    UploadModule,

    LlmModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
