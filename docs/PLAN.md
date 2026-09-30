# AI Job & Client Agent — FINAL Plan (simplest path that works end to end)

**Owner:** Ghulam Ghaus (GG IT SOLUTIONS) · **Save as:** `docs/PLAN.md`
**Supersedes v1 and v2.** This is the only file the Antigravity agent should follow.

## 0. Objective and the honest definition of "maximum applies"

Get the **most applications to the best-matching** Saudi/UAE jobs, freelance projects, and direct clients, with the least manual work and no account bans.

The real bottleneck is **not clicking Apply**, it is *finding good matches and writing a correct, tailored application for each*. So the system does everything up to the final click:

```text
Discover → Dedupe → Filter → AI Extract → Score → Build "Apply Pack" → You approve on Telegram → You click Apply → Track
```

An **Apply Pack** = best CV + tailored cover note/proposal + pre-filled answers to common questions + the direct apply link. Approving and submitting one pack should take about 1–2 minutes. A realistic target is **15–25 high-quality applications/day** (a target, not a guarantee).

**Why humans keep the last click:** LinkedIn, Upwork and most portals prohibit unauthorized automation; Upwork explicitly treats tools that act faster than a human as bots and bans auto-submitted proposals. A ban would destroy the whole objective. Auto-clicking Apply adds little speed and large risk.

---

## 1. Final decisions (v1 vs v2 → one answer)

| Topic | v1 | v2 | **FINAL** | Why |
|---|---|---|---|---|
| Project layout | pnpm monorepo | 2 CLI-made projects | **2 projects: `backend/` (Nest) + `frontend/` (Next)** | Pure official CLIs; no custom monorepo config for the agent to invent |
| Language | TS + Python | TS only | **TypeScript only** | One runtime, fewer failure points |
| ORM | Prisma | Prisma 7 | **Prisma 7 + Postgres** | Code-first migrations, best typing, official Nest recipe |
| Queue | pg-boss | BullMQ + Redis | **BullMQ + Redis (Docker)** | Built-in retries and rate limiting (needed for LLM quotas); official Nest docs |
| Scheduler | queue cron | `@nestjs/schedule` | **`@nestjs/schedule`** | Official, simple |
| Job discovery | Scrapers/Playwright | Email + ATS APIs + clipper | **Email alerts + public ATS APIs + manual paste** | Stable, no credential risk, no ToS fights |
| Auto-apply (Playwright) | Phase 3 | Phase 3 | **Removed from MVP** | High risk, low gain; Apply Pack gets ~90% of the time saving |
| LLM | Gemini free + Groq + Ollama | Cloud only | **Cloud primary (Gemini → Groq), Ollama optional pre-filter adapter, OFF by default** | Minimal PC load; local only if quotas bite (see §5) |
| Users | single user | multi-user + Super Admin | **Multi-user data model, one seeded Super Admin** | Future-proof at almost zero cost |
| Auth | env password | JWT + refresh + 2FA + CASL | **JWT in HTTP-only cookie, roles, `userId` scoping. 2FA/CASL later** | Enough for MVP, upgradable |
| Notifications | Telegram + email | Telegram, Resend, Calendar, WhatsApp | **Telegram + in-app only** | Free, instant, has buttons. Email/Calendar/WhatsApp/SMS deferred |
| Public showcase | Later | Sprint 5 | **Sprint 5** | Not needed for the job-search loop |

---

## 2. Minimal architecture

```text
                    ┌──────────────────────────── Ingestion (Sprint 2/3/4) ───────────────────────────┐
Dedicated Gmail  →  │ Alert emails (LinkedIn/Bayt/GulfTalent/Naukrigulf/Indeed/Upwork) → parser       │
Public ATS APIs  →  │ Greenhouse / Lever company boards                                                │ → BullMQ queues
Paste URL/text   →  │ Manual import (works for any site)                                               │
Google Places    →  │ Direct-client leads (Sprint 4)                                                   │
                    └─────────────────────────────────────────────────────────────────────────────────┘
                                                     │
                       normalize → dedupe → rule filter → LLM extract (evidence) → score (code)
                                                     │
                            score ≥ 80: build Apply Pack   65–79: daily digest   <65: archive
                                                     │
                     Telegram card [Open link] [Pack] [Applied] [Reject]  +  Next.js dashboard
```

**Runs locally:** Node (NestJS + Next.js), Postgres, Redis (Docker). AI runs in the cloud. Playwright is not used.

---

## 3. Final stack

| Layer | Choice |
|---|---|
| Backend | NestJS + TypeScript (`nest new`) |
| Frontend | Next.js App Router + Tailwind + shadcn/ui (`create-next-app`, `shadcn` CLI) + TanStack Query |
| DB | PostgreSQL via Docker (`pgvector/pgvector` image so embeddings need no re-platforming) + **Prisma 7** (`@prisma/adapter-pg`) |
| Queue/cron | BullMQ + Redis (`@nestjs/bullmq`), `@nestjs/schedule`, Bull Board (Super Admin only) |
| Validation | class-validator DTOs (HTTP), Zod (LLM output only) |
| LLM layer | Vercel AI SDK provider abstraction; chain `gemini,groq` (+ optional `ollama`) via env |
| Email ingestion | Dedicated Gmail account; read with IMAP app password (simplest) or Gmail API OAuth |
| Notifications | Telegram bot (long polling in dev) + in-app notification table |
| Standards | Global response interceptor, exception filter, request-ID middleware, ValidationPipe, `nestjs-pino`, Helmet, CORS allow-list, throttler, Swagger, terminus `/health` |
| Typed FE client | Generate from Swagger JSON (`orval` or `openapi-typescript`) |
| Tests/CI | Jest + GitHub Actions |

---

## 4. Getting job data without credential risk

**Rule 1:** the app never sees your platform passwords.
**Rule 2:** use a **dedicated Gmail account** (e.g., `gg.jobalerts@gmail.com`) that only receives job alerts. If its credential ever leaks, nothing else of yours is exposed.

| Source | How | Coverage | Risk |
|---|---|---|---|
| **Job-alert emails** (main engine) | Create saved-search alerts on LinkedIn, Bayt, GulfTalent, Naukrigulf, Indeed, Upwork, pointing to the dedicated mailbox. App reads new emails, extracts job titles/links/snippets | Every portal that sends alerts | Very low |
| **Public ATS APIs** | Greenhouse (`boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`) and Lever (`api.lever.co/v0/postings/{company}?mode=json`) publish job data with no authentication; Greenhouse states its GET data is public, and Lever says published postings may be read by third parties. Ashby has a similar endpoint but at least one tool reports its robots.txt refuses crawlers, so treat Ashby as optional and check first | Gulf companies that use these systems (you build the company list) | Low; poll gently (1 request/second, a few times a day) |
| **Manual paste / URL** | Paste job text or link | Anything | None |
| **Browser clipper** (later) | Tiny Chrome extension: you view a job, click "Send to Agent" | Anything you browse | None |

**Two ways to read the mailbox**

- **IMAP + Gmail app password (recommended for MVP).** Needs 2-Step Verification on that dedicated account. No Google Cloud project, no token expiry. Verify the current Google setting is available for your account type.
- **Gmail API (OAuth).** Fine, but if your OAuth consent screen stays in "Testing", refresh tokens expire after 7 days; moving it to "In production" removes that limit. Use only if IMAP is unavailable.

**Freelance (Upwork):** alert emails → same pipeline with `type=FREELANCE` → proposal draft → **you paste and submit**. Never automate submission or scraping. Optional: request an official Upwork API key later for a legitimate use case.
**Fiverr:** no job feed exists; later add inbox-reply drafting from Fiverr notification emails. Not in MVP.
**Direct clients (Sprint 4):** Google Places API (New) → businesses with websites → website need-signal analysis → outreach draft → you approve and send. See §8.

---

## 5. LLM strategy (cloud first, local only if needed)

**Your paid Antigravity plan covers the IDE only.** The app's runtime AI needs an API key.

### Volume math (why free quotas are enough to start)
```text
~200 raw items/day → dedupe + rule filter (code/SQL, no LLM) → ~60 candidates
60 extraction calls  +  ~15 proposals (only score ≥ 80)  →  ~80–100 LLM calls/day
```
Reported Gemini free-tier limits for Flash-class models fall roughly in the hundreds of requests per day with a few requests per minute (limits change; check AI Studio → Rate limits). So ~100 calls/day fits, provided a global rate limiter and retries exist (BullMQ limiter).

### Model tiering
| Task | Model tier |
|---|---|
| Title/snippet relevance batch | smallest (Flash-Lite class) |
| Requirement extraction | Flash class |
| Match explanation, Apply Pack, proposals | best available Flash-class model |

### Fallbacks, in order
1. Gemini → Groq (automatic on HTTP 429/quota errors).
2. If still short: enable billing on the Gemini API (pay per token; Flash-Lite class is cheap) — this also raises limits and changes the data-use terms versus the free tier.
3. **Local LLM (Ollama) — optional, off by default.** Use it **only** as a cheap pre-filter (yes/no relevance on title + snippet) if you exceed cloud quotas and don't want to pay, or for sensitive text. Use a small instruct model (roughly 3–8B parameters), never for proposals. It loads your PC only while a batch runs.

**Privacy:** free-tier prompts may be used by the provider to improve models. Send only job text + the minimum profile facts; never IDs, phone numbers, addresses, salary history.

### How we get expert-level accuracy
1. **Evidence-based extraction:** every extracted field carries a quoted `evidence` snippet from the job text; no evidence → `null/Unknown`.
2. **Scoring in code**, not by the LLM (skill overlap, years, location, seniority, salary, visa flags). LLM only explains.
3. **Two-pass proposals:** draft (uses only supplied facts) → verifier pass checks every claim against profile/projects/answer bank; unsupported claim blocks approval.
4. **Golden set:** 30 real job posts you label by hand; a Jest eval script runs on every prompt/model change.
5. Low temperature, versioned prompts, Zod validation, one retry, then `needs_review`.

---

## 6. Users, auth, profile (multi-user ready, minimal build)

- Tables: `User(role: SUPER_ADMIN | USER)`, every domain table has `userId`. Scope all queries by `userId` in one place (a Prisma client extension or base service).
- **No signup** (`ALLOW_SIGNUP=false`). `prisma db seed` creates you as SUPER_ADMIN from env; change the password on first login.
- Auth: `POST /auth/login|refresh|logout`, access token (short) + refresh token (rotated), both in HTTP-only Secure SameSite cookies, argon2 hashing, login rate-limit.
- Guards: `JwtAuthGuard` + `RolesGuard`. Later: TOTP 2FA, CASL abilities, organizations.
- **Profile you must fill once (needed for good matches):** basics + languages; visa/notice/relocation facts; experience; skills (level, years); projects (structured, tagged); CV versions with tags; job preferences (roles, countries, min salary, blacklist); answer bank; Telegram link.
- The AI can read all of it but never edits it. Unknown facts stay "Unknown".

---

## 7. Data model (first migration set)

```text
User, Session
Profile, Experience, Skill, Project, Cv, AnswerBankItem, JobPreference
Source(type: EMAIL|ATS|MANUAL|PLACES, config, lastRunAt, status)
Opportunity(userId, type: JOB|FREELANCE|LEAD, contentHash UNIQUE(userId,hash), fingerprint,
            title, company, country, city, url, rawText, language, postedAt, status)
OpportunityRequirement(json, evidenceJson, promptVersion, model)
OpportunityMatch(score, breakdownJson, gapsJson, recommendedCvId)
ApplyPack(opportunityId, cvId, draftText, factsUsedJson, answersJson, verifierReportJson, version)
Application(status enum, appliedAt, notes)   ApprovalRecord(applyPackId, version, approvedAt)
Company, Contact, OutreachMessage, SuppressionEntry   # Sprint 4
Notification, AutomationRun, AuditLog, LlmCall, Setting
```

Every schema change = edit `schema.prisma` → `pnpm prisma migrate dev --name <change>` → commit. Production: `prisma migrate deploy`. Use `--create-only` for extension SQL (`CREATE EXTENSION vector`).

**Application statuses:** Discovered, Qualified, Draft Ready, Awaiting Approval, Applied, Viewed, Shortlisted, Interview, Offer, Rejected, Withdrawn, Closed.

---

## 8. Scoring, thresholds, safety

**Score (code):** Technical 30 · Experience 20 · Location 10 · Seniority 10 · Salary 10 (Unknown = neutral + flag) · Visa/relocation 10 (Unknown = flag) · Industry/projects 5 · Other 5. Weights configurable in Settings.

**Actions by score:** ≥ 80 → build Apply Pack + Telegram card · 65–79 → daily digest, pack on demand · < 65 → archived.
**Freelance score** adds: budget fit, client history/verification, proposals already submitted (competition), scope clarity.

**Direct-client leads (Sprint 4):** Places API text search with a field mask → businesses with websites → fetch public site politely (robots.txt) → LLM need-signals with evidence (no booking, no app, no chatbot, outdated site…) → qualify → outreach draft. Cost control: Google's current Places pricing gives per-SKU free monthly caps (e.g., Text Search Pro 5,000, Enterprise-level fields 1,000) then per-1,000 fees, and billing must be enabled. Request only needed fields, set a hard quota and budget alert. Store place IDs plus your own notes; check Google's terms on caching other Places data. Outreach: daily cap (default 15), clear sender identity, opt-out line, global suppression list, human approval every time.

**Never:** invent experience/skills/degrees/certs/salary/visa status; claim work authorization you don't have; submit without an `ApprovalRecord` for that exact version; bypass CAPTCHA/MFA/anti-bot; scrape sites that forbid it; send bulk spam.

---

## 9. Telegram (the control panel)

Setup: create bot with @BotFather → token in `.env` → link chat via `/start <code>` from the dashboard. Long polling in dev (no public URL). Card:

```text
🔥 Backend Engineer — Riyadh · 91%
Skills: Node.js, NestJS, PostgreSQL · Visa: Unknown · Salary: Unknown
Gap: AWS cert preferred · CV: backend-nodejs
[Open link] [View pack] [Mark applied] [Reject]
```

Daily report (20:00): new items, strong matches, packs waiting, applications, replies, LLM calls vs budget. In-app notifications mirror everything.

---

## 10. Build rules for Antigravity (paste into `AGENTS.md` and Workspace Rules)

```text
PROJECT: AI Job & Client Agent. Follow docs/PLAN.md exactly. Build only the sprint requested.

SCAFFOLDING = OFFICIAL CLIs ONLY
- Backend: `nest new backend --package-manager pnpm --strict`; every module/resource/guard/filter/
  interceptor/pipe/middleware/decorator via `nest g ...` (`nest g resource <name>` for CRUD domains).
- Frontend: `pnpm create next-app@latest frontend` then `pnpm dlx shadcn@latest init/add`.
- DB: Prisma CLI only (init, migrate dev, generate, db seed). Follow docs.nestjs.com/recipes/prisma and Prisma 7 docs.
- Packages: `pnpm add` / `pnpm add -D` only. Never hand-write dependency lists.
- Never hand-create a file a generator can create. You may edit generated files.
- Check official docs for setup steps before using any library; do not rely on memory.
- Interactive command? Run it and answer prompts. If it fails, show me the error.

DATABASE: code-first only. No manual table edits, no `db push`, never edit applied migrations.

NESTJS STANDARDS: global ValidationPipe (whitelist/transform/forbidNonWhitelisted), global exception
filter + response interceptor (one envelope), request-ID middleware, nestjs-pino (redact secrets),
@nestjs/config with env validation, Helmet, CORS allow-list, throttler, URI versioning /api/v1,
Swagger, terminus health. Controllers thin; logic in services.

SAFETY: never store/log platform passwords. Never invent facts. Unknown = "Unknown". Every claim in a
generated pack traces to profile data. Nothing is marked Applied or sent without an ApprovalRecord.
No CAPTCHA/MFA/anti-bot bypass. All queries scoped by userId. LLM output validated with Zod; every
LLM call logged to LlmCall; cache by content hash.

WORKFLOW: propose a short plan first and wait for my OK. After each task: typecheck, lint, test, then
summarize what changed and how to run it.
```

**Credit-saving:** one sprint per conversation · plan first · generators cost zero tokens · commit after each working step · keep terminal approval on for installs/migrations.

---

## 11. Sprints (each ends with something you can use)

### Sprint 0 — Foundation
```text
Do Sprint 0 only. Plan first.
1. docker-compose.yml: pgvector/pgvector Postgres + Redis. .env.example.
2. `nest new backend ...`, `pnpm create next-app@latest frontend`, shadcn init.
3. Prisma 7 per the official Nest recipe. Models: User, Session, AuditLog, Setting. Migrate via CLI.
4. Generate with `nest g` and fill in the standards from §10 (interceptor, filter incl. Prisma errors, request-ID middleware, pipes, pino, config validation, Helmet, throttler, Swagger, health).
5. Auth per §6 + seed script creating the Super Admin. ALLOW_SIGNUP=false.
6. Frontend: login, protected layout, dashboard shell. Generate typed API client from Swagger.
7. GitHub Actions: lint + typecheck + test.
DONE WHEN: I can log in as Super Admin locally and /health is green.
```

### Sprint 1 — Profile + manual import + scoring (the brain)
```text
Do Sprint 1 only (PLAN §5–§8).
1. `nest g resource` for profile, experience, skills, projects, cvs, answer-bank, preferences, opportunities. Prisma models + migrations via CLI.
2. Onboarding pages + CV upload (StorageService interface, local disk).
3. LLMProvider abstraction (Vercel AI SDK), LLM_CHAIN from env, 429 fallback, rate limiter, LlmCall logging, content-hash cache.
4. Manual import (paste text or URL) with contentHash dedupe.
5. Evidence-based extraction (Zod), prompt versioning, "Unknown" handling.
6. Code-based scoring, gaps, CV recommendation.
7. Jobs list (sorted by score) + job detail page.
8. Golden-set eval script + unit tests for scoring/dedupe.
DONE WHEN: I paste 10 real Saudi/UAE jobs and get sensible, evidence-backed scores.
```

### Sprint 2 — Automation: email + ATS ingestion, queue, Telegram, Apply Pack
```text
Do Sprint 2 only.
1. @nestjs/bullmq + Redis + Bull Board (Super Admin only); @nestjs/schedule cron (08:00, 14:00, 20:00, configurable).
2. Email connector: read the dedicated job-alerts mailbox via IMAP (app password in env), parse alert emails from LinkedIn/Bayt/GulfTalent/Naukrigulf/Indeed/Upwork into Opportunities. Parsers are per-sender, fail soft, log unparseable emails.
3. ATS connector: Greenhouse + Lever public endpoints with a company list managed in the dashboard; 1 req/sec; never throws on errors.
4. Pipeline: ingest → normalize → dedupe (hash + fingerprint) → rule filter → extract → score, with BullMQ retries and a global LLM rate limiter.
5. ApplyPack generation for score ≥ 80: tailored note, CV pick, answer-bank answers, "Facts used", two-pass verifier.
6. Telegram bot (long polling): cards with buttons, /start linking, daily report. In-app notifications.
7. ApprovalRecord + Applications tracker page + status history in AuditLog.
DONE WHEN: I wake up to a Telegram list of strong matches with ready packs, and I can approve and mark applied in two taps.
```

### Sprint 3 — Freelance
```text
Do Sprint 3 only. Upwork alert-email parser, FREELANCE scoring (budget, client fit, competition, scope clarity), proposal generator with the verifier pass, packs on Telegram. I submit manually. No Upwork scraping or automation.
```

### Sprint 4 — Direct clients
```text
Do Sprint 4 only. Places API (New) connector with field mask, quota guard and cost counter; website need-signal analysis with evidence; qualification score; outreach draft; SuppressionEntry list; daily send cap; approval before every send; lead statuses (Researching, Qualified, Draft Ready, Contacted, Replied, Meeting, Proposal Sent, Won, Lost, Not Interested); follow-up reminders on Telegram.
```

### Sprint 5 — Showcase, admin, hardening
```text
Do Sprint 5 only. Public pages (/, /u/[slug], /products) fed by a whitelist-only public DTO with ISR; Super Admin area (users/roles, sources, LLM usage, queues, audit logs); TOTP 2FA; backups script; browser clipper extension; optional Resend digest email.
```

### Later (only if the loop is proven)
Embeddings (pgvector), tailored CV generation from verified data, interview prep, Google Calendar, Fiverr inbox drafts, organizations/CASL/plans for the GG IT SOLUTIONS product, optional Ollama pre-filter.

---

## 12. Environment (`.env.example`)

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jobagent
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
ENCRYPTION_KEY=               # 32-byte base64
ALLOW_SIGNUP=false
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASSWORD=         # seed only; change after first login
LLM_CHAIN=gemini,groq         # add ollama only if you enable the local pre-filter
GEMINI_API_KEY=
GROQ_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
LLM_DAILY_CALL_BUDGET=300
TELEGRAM_BOT_TOKEN=
JOBALERTS_IMAP_HOST=imap.gmail.com
JOBALERTS_IMAP_USER=
JOBALERTS_IMAP_APP_PASSWORD=
GOOGLE_PLACES_API_KEY=        # Sprint 4: restrict by API, set quota + budget alert
API_PORT=4000
WEB_URL=http://localhost:3000
```

---

## 13. Success metrics and checkpoints

- **Week 1:** Sprint 0–1 done; scores on 10 pasted jobs agree with your own judgment ≥ 80% of the time (golden set).
- **Week 2–3:** Sprint 2 live; daily strong-match list on Telegram; ≥ 10 approved applications/day within a few days.
- **Track:** discovered → qualified → packs → applied → response → interview → offer/client. Optimize response and interview rate, not application count. Review weekly: which sources and score bands actually produce replies, then adjust weights and sources.

## 14. Verify before relying (things that change)
Free-tier LLM limits and terms · Gmail app-password availability for your account · each portal's alert email format (parsers may need tweaks) · Places API pricing/caps · each site's Terms before any automation.
