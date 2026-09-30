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
