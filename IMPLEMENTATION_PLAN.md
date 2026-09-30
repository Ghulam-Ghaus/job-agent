# AI Job & Client Agent — Implementation Plan & Phase Tracker

Based on the master specification in [`docs/PLAN.md`](file:///d:/PL/job-agent/docs/PLAN.md).

---

## 📊 Phase & Sprint Progress Tracker

### [ ] Sprint 0: Foundation & Core Infrastructure
- [ ] **0.1 Environment & Containers**
  - [ ] Create `docker-compose.yml` (`pgvector/pgvector:pg16` + `redis:7-alpine`) with health checks & volumes
  - [ ] Create `.env.example` with DB, Redis, JWT, and application keys
- [ ] **0.2 Scaffolding (Official CLIs only)**
  - [ ] Backend: `pnpm dlx @nestjs/cli new backend --package-manager pnpm --strict`
  - [ ] Frontend: `pnpm create next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
  - [ ] Frontend UI: Initialize `shadcn/ui`
- [ ] **0.3 Database & Prisma 7 Layer**
  - [ ] Install Prisma 7 (`@prisma/client`, `prisma`, `@prisma/adapter-pg`, `pg`)
  - [ ] Configure `backend/prisma/schema.prisma` (`User`, `Session`, `AuditLog`, `Setting`)
  - [ ] Run initial migration via CLI: `pnpm prisma migrate dev --name init_foundation`
- [ ] **0.4 NestJS Enterprise Standards & Middleware**
  - [ ] Global `ValidationPipe` (`whitelist`, `transform`, `forbidNonWhitelisted`)
  - [ ] Global Exception Filter (with Prisma error mapping) & Response Interceptor (standard envelope)
  - [ ] Request-ID middleware & `nestjs-pino` logger (secret redaction)
  - [ ] Security headers (`helmet`), CORS allow-list, `@nestjs/throttler` rate limiting
  - [ ] URI versioning (`/api/v1`) & Swagger documentation (`/api/docs`)
  - [ ] Terminus health check (`/api/v1/health`)
- [ ] **0.5 Authentication & Super Admin Seed**
  - [ ] JWT authentication in HTTP-only secure cookies (`POST /auth/login`, `/refresh`, `/logout`)
  - [ ] Argon2 password hashing; enforce `ALLOW_SIGNUP=false`
  - [ ] `backend/prisma/seed.ts` to seed initial `SUPER_ADMIN`
- [ ] **0.6 Frontend Shell & Typed API Client**
  - [ ] Generate typed API client from Swagger schema (`openapi-typescript`)
  - [ ] Configure TanStack Query
  - [ ] Build login page, protected layout, session management, and dashboard shell
- [ ] **0.7 CI & Verification**
  - [ ] Configure GitHub Actions workflow (lint + typecheck + test)
  - [ ] **Done When:** Log in as Super Admin locally and `/api/v1/health` is green

---

### [ ] Sprint 1: Profile, Manual Import & Evidence-Based Scoring ("The Brain")
- [ ] **1.1 Domain Models & Resources**
  - [ ] Generate NestJS resources (`nest g resource`) and Prisma models for `Profile`, `Experience`, `Skill`, `Project`, `Cv`, `AnswerBankItem`, `JobPreference`, and `Opportunity`
  - [ ] Run migration: `pnpm prisma migrate dev --name add_profile_and_opportunities`
- [ ] **1.2 Onboarding & CV Storage**
  - [ ] Build frontend profile setup wizard (skills, years, visa, notice period, portfolio links)
  - [ ] Storage service abstraction (local disk for MVP) for CV file uploads
- [ ] **1.3 LLM Provider Abstraction**
  - [ ] Vercel AI SDK integration supporting `LLM_CHAIN=gemini,groq` with HTTP 429 fallback
  - [ ] BullMQ rate limiter, `LlmCall` audit logging, and SHA-256 content-hash caching
- [ ] **1.4 Manual Ingestion & Deduplication**
  - [ ] Manual import endpoint (paste text or URL) with SHA-256 `contentHash` deduplication
- [ ] **1.5 Evidence-Based AI Extraction**
  - [ ] Extract requirements, visa conditions, tech stack, and salary into typed Zod schemas
  - [ ] Rule: Every field requires quoted evidence snippet from job text; otherwise `"Unknown"`
- [ ] **1.6 Deterministic Code-Based Scoring**
  - [ ] Scoring engine in pure TypeScript code (Tech 30, Exp 20, Loc 10, Seniority 10, Salary 10, Visa 10, Projects 5, Other 5)
  - [ ] Identify skill gaps and recommend optimal CV
- [ ] **1.7 Frontend Job Board**
  - [ ] Job list sorted by match score, score breakdown drawer, and evidence viewer
- [ ] **1.8 Golden Set Evaluation**
  - [ ] Hand-label 30 real job postings and add Jest eval test suite
  - [ ] **Done When:** 10 pasted real Saudi/UAE jobs yield accurate, evidence-backed scores matching judgment >= 80%

---

### [ ] Sprint 2: Automated Pipeline, Telegram Bot & Apply Packs
- [ ] **2.1 Queues & Scheduling**
  - [ ] `@nestjs/bullmq` with Redis and Bull Board (restricted to Super Admin)
  - [ ] `@nestjs/schedule` cron triggers (08:00, 14:00, 20:00)
- [ ] **2.2 Ingestion Connectors**
  - [ ] Dedicated Gmail IMAP connector (app password) with fail-soft parsers (LinkedIn, Bayt, GulfTalent, Naukrigulf, Indeed, Upwork)
  - [ ] Public ATS connector for Greenhouse & Lever (1 req/sec rate limit)
- [ ] **2.3 Processing Pipeline**
  - [ ] BullMQ flow: `Ingest` -> `Normalize` -> `Dedupe` -> `Rule Filter` -> `LLM Extract` -> `Score`
- [ ] **2.4 Two-Pass Apply Pack Builder**
  - [ ] For score >= 80: generate tailored note, select best CV, pre-fill Answer Bank answers
  - [ ] Pass 2 (Verifier): Block any unverified claims not found in master profile
- [ ] **2.5 Telegram Bot Control Panel**
  - [ ] Long-polling bot with inline action buttons (`[Open link]`, `[View pack]`, `[Mark applied]`, `[Reject]`)
  - [ ] Account linking via `/start <code>` and daily digest at 20:00
- [ ] **2.6 Application Tracker & Audit**
  - [ ] Create `ApprovalRecord` on approval; track status (`Discovered` -> `Applied` -> `Interview`, etc.)
  - [ ] **Done When:** Wake up to Telegram cards with ready Apply Packs; approve and mark applied in under 2 minutes

---

### [ ] Sprint 3: Freelance Pipeline (Upwork)
- [ ] **3.1 Freelance Ingestion**
  - [ ] Parse Upwork alert emails with `type = FREELANCE`
- [ ] **3.2 Freelance Scoring Engine**
  - [ ] Augment scoring with budget fit, client payment verification/history, proposal competition, scope clarity
- [ ] **3.3 Verified Proposal Generator**
  - [ ] Two-pass proposal generator delivered to Telegram for manual submission
  - [ ] **Done When:** Upwork alert emails produce verified proposal drafts on Telegram ready to copy, paste, and submit manually

---

### [ ] Sprint 4: Direct Client Lead Engine
- [ ] **4.1 Google Places (New) Integration**
  - [ ] Text Search Pro with strict field masks and budget guardrails to retrieve local businesses with websites
- [ ] **4.2 Need-Signal Website Analysis**
  - [ ] Polite web fetcher (`robots.txt` compliant)
  - [ ] Evidence-based need-signal extraction (missing online booking, outdated UI, broken flows, no mobile responsiveness)
- [ ] **4.3 Outreach Drafter & CRM Safety**
  - [ ] Generate personalized B2B outreach proposals addressing detected gaps
  - [ ] Daily sending cap (default: 15), sender transparency, unsubscribe/opt-out line, suppression list
  - [ ] Lead pipeline tracker (`Researching` -> `Qualified` -> `Contacted` -> `Replied` -> `Won/Lost`)
  - [ ] **Done When:** Google Places leads are audited within budget limits, need-signals identified, and outreach queued for review

---

### [ ] Sprint 5: Showcase, Admin Hardening & Extensions
- [ ] **5.1 Public Showcase Pages**
  - [ ] Public read-only portfolio `/u/[slug]` with Next.js ISR and strict whitelist DTOs
- [ ] **5.2 Super Admin Control Center**
  - [ ] Dashboard for queue monitoring (Bull Board), LLM token costs, source health, user management
- [ ] **5.3 Security Hardening**
  - [ ] TOTP 2-Factor Authentication, automated DB backup script
- [ ] **5.4 Browser Clipper**
  - [ ] Chrome extension to send current job page directly to agent
  - [ ] **Done When:** Public showcase is accessible with zero private data leakage, Super Admin metrics visible, backup verified

---

## 🚀 Execution Strategy: Sprint 0 Step-by-Step

| Task # | Task Description | Commands / Tools |
|---|---|---|
| **0.1** | Setup Docker services & environment | `docker-compose.yml`, `.env.example` |
| **0.2** | Scaffold backend & frontend | `pnpm dlx @nestjs/cli new backend`, `pnpm create next-app@latest frontend` |
| **0.3** | Prisma 7 schema & migration | `@prisma/adapter-pg`, `pnpm prisma migrate dev` |
| **0.4** | NestJS standards & cross-cutting | Filters, interceptors, pipes, pino, helmet, swagger, health |
| **0.5** | Auth & Super Admin seed | JWT in HTTP-only cookies, argon2, `prisma/seed.ts` |
| **0.6** | Frontend shell & typed client | `openapi-typescript`, TanStack Query, Login page, Dashboard |
| **0.7** | CI & End-to-end verification | GitHub Actions, verify `/api/v1/health` and login flow |
