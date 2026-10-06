import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Idempotent import of production projects & skills into the Master Profile.
 * Facts below are copied from the owner's own project descriptions — nothing is invented.
 * A project is updated or inserted if an existing one matches by normalized title or alias.
 * Unique skills are upserted into the user's Skill pool with zero duplicates.
 *
 * Usage:  pnpm --filter backend exec tsx prisma/seed-projects.ts [--dry]
 */

interface SeedProject {
  title: string;
  aliases: string[];
  description: string;
  techStack: string[];
  highlights: string[];
  tags: string[];
}

const PROJECTS: SeedProject[] = [
  {
    title: 'Real-Time Voice Intake Platform (Enterprise AI Agent)',
    aliases: ['voice intake system', 'voice intake', 'ai voice intake', 'real time voice intake platform'],
    description:
      'AI-powered voice assistant platform for business intake and customer interactions using Twilio and LLMs. Designed for live phone calls with low-latency audio streaming, conversational agents for call qualification, automated booking, and deterministic state machine (FSM) workflows.',
    techStack: [
      'Python',
      'Node.js',
      'Twilio',
      'SendGrid',
      'Google Calendar API',
      'WebSockets',
      'OpenAI',
      'Whisper STT',
      'Piper',
      'Cartesia TTS',
      'Voice to Voice',
      'LLM',
      'Agentic AI',
      'RAG',
      'Generative AI',
      'AI Agent',
      'FSM Deterministic',
      'n8n',
      'Vapi',
      'Supabase',
    ],
    highlights: [
      'Handles live phone calls with low-latency audio streaming and Voice-to-Voice pipelines',
      'Deterministic finite-state machine (FSM) qualification and automated booking workflows',
      'Multi-tenant backend integrating STT/TTS pipelines, Supabase persistence, and external calendaring/email',
      'Agentic RAG workflows and tool calling for real-time customer data retrieval',
    ],
    tags: ['AI', 'Voice AI', 'Agentic AI', 'Real-time', 'FSM', 'RAG'],
  },
  {
    title: 'Esports Event Management Platform',
    aliases: ['esports event management platform', 'esports platform', 'esports management'],
    description:
      'Enterprise platform for managing gaming tournaments, teams, schedules, and live event management. Features real-time bracket orchestration, live game telemetry, and multi-tier data storage.',
    techStack: ['Next.js', 'Node.js', 'NestJS', 'Socket.io', 'Supabase', 'S3 / Bucket', 'DynamoDB'],
    highlights: [
      'Real-time tournament bracket orchestration and live score tracking using Socket.io and WebSockets',
      'Team, player, and schedule management with live match event streaming',
      'Multi-tier cloud storage combining Supabase, S3 buckets, and DynamoDB for high-throughput reads',
    ],
    tags: ['Gaming', 'Esports', 'Real-time', 'WebSockets', 'Cloud'],
  },
  {
    title: 'JobAgent AI Autopilot (Autonomous Career & Client Agent)',
    aliases: ['jobagent ai autopilot', 'jobagent', 'ai job agent', 'job agent'],
    description:
      'Autonomous agentic career accelerator and client discovery engine. Crawls corporate ATS portals (Greenhouse, Lever) and freelance boards, scores opportunities via deterministic profile fact-matching, generates JD-targeted vector CVs/letters via PDFKit, enforces human-in-the-loop ApprovalRecords, and dispatches real-time Telegram alerts.',
    techStack: [
      'Next.js',
      'NestJS',
      'TypeScript',
      'PostgreSQL',
      'Prisma',
      'Redis',
      'BullMQ',
      'Agentic AI',
      'RAG',
      'Generative AI',
      'AI Agent',
      'FSM Deterministic',
      'n8n',
      'Vapi',
      'PDFKit',
    ],
    highlights: [
      'Autonomous multi-channel ingestion with ATS connectors, deduplication engine, and rate limiting',
      'Deterministic RAG-style profile fact-matching with zero AI hallucination safeguard',
      'Human-in-the-loop ApprovalRecords requiring explicit user confirmation before application dispatch',
      'Location-aware vector PDFKit engine auto-generating Gulf Executive vs European Standard CV layouts',
      'Real-time Telegram notifications and background job orchestration via Redis & BullMQ',
    ],
    tags: ['AI Agent', 'Agentic AI', 'RAG', 'Automation', 'Full Stack', 'NestJS'],
  },
  {
    title: 'The Nursery App (TNA)',
    aliases: ['nursery app', 'tna'],
    description:
      'SaaS platform for nursery management supporting staff, parent, and child roles with role-based access control. Implemented invoicing and financial workflows through integrations with Xero and QuickBooks, along with notification and user-management features in a scalable backend architecture.',
    techStack: ['Node.js', 'Express', 'MySQL', 'AWS', 'Serverless', 'DynamoDB'],
    highlights: [
      'Role-based access control for staff, parent, and child roles',
      'Invoicing and financial workflows integrated with Xero and QuickBooks',
      'Notification and user-management features in a scalable backend',
    ],
    tags: ['SaaS', 'Fintech Integration', 'RBAC', 'Serverless'],
  },
  {
    title: 'User Management System (UMS)',
    aliases: ['user management system', 'ums'],
    description:
      'Centralized authentication and authorization microservice providing single sign-on (SSO) across multiple applications. Designed secure identity workflows using OAuth2, JWT, and role-based access control to improve security and operational efficiency.',
    techStack: ['Node.js', 'NestJS', 'PostgreSQL', 'TypeORM'],
    highlights: [
      'Single sign-on (SSO) across multiple applications',
      'Secure identity workflows using OAuth2, JWT, and RBAC',
    ],
    tags: ['Auth', 'Microservice', 'SSO', 'Security'],
  },
  {
    title: 'Virtual Hospital System (VHS)',
    aliases: ['virtual hospital system', 'vhs'],
    description:
      'Web platform enabling secure communication between physicians and patients, including appointment scheduling and virtual consultations. Implemented real-time notifications and updates using WebSockets to improve coordination and user engagement.',
    techStack: ['Node.js', 'NestJS', 'PostgreSQL', 'WebSockets'],
    highlights: [
      'Secure physician–patient communication with appointment scheduling and virtual consultations',
      'Real-time notifications and updates using WebSockets',
    ],
    tags: ['Healthcare', 'Real-time', 'Web Platform'],
  },
  {
    title: 'Hive Enterprise Resource Optimizer (HERO)',
    aliases: ['hive enterprise resource optimizer', 'hero'],
    description:
      'Enterprise platform for KPI planning and organizational performance tracking using top-down and bottom-up approaches. Delivered real-time dashboards and reports to provide management with continuous visibility into progress and outcomes.',
    techStack: ['Node.js', 'NestJS', 'PostgreSQL', 'WebSockets', 'CRON'],
    highlights: [
      'KPI planning and performance tracking with top-down and bottom-up approaches',
      'Real-time dashboards and reports for management visibility',
    ],
    tags: ['Enterprise', 'KPI', 'Dashboards', 'Real-time'],
  },
  {
    title: 'Asset Management System',
    aliases: ['asset management'],
    description:
      'Backend microservice for uploading, categorizing, and managing digital assets across multiple applications. Designed efficient file-handling and storage workflows to ensure optimized retrieval and maintainability.',
    techStack: ['Node.js', 'Express', 'Multer', 'PostgreSQL'],
    highlights: [
      'Upload, categorize, and manage digital assets across multiple applications',
      'Efficient file-handling and storage workflows for optimized retrieval',
    ],
    tags: ['Microservice', 'File Storage'],
  },
  {
    title: 'Hire Purchase Management System (HPMS)',
    aliases: ['hire purchase management system', 'hpms'],
    description:
      'Web-based system for managing hire purchase transactions, including customer onboarding, payment tracking, invoicing, and automated notifications. Built to support secure financial workflows and data consistency.',
    techStack: ['Node.js', 'Express', 'PostgreSQL', 'TypeORM'],
    highlights: [
      'Customer onboarding, payment tracking, invoicing, and automated notifications',
      'Secure financial workflows with data consistency',
    ],
    tags: ['Fintech', 'Invoicing', 'Web Platform'],
  },
];

const SKILLS_TO_SEED = [
  { name: 'Agentic AI', category: 'AI & Machine Learning', level: 'EXPERT' },
  { name: 'RAG', category: 'AI & Machine Learning', level: 'EXPERT' },
  { name: 'Generative AI', category: 'AI & Machine Learning', level: 'EXPERT' },
  { name: 'AI Agent', category: 'AI & Machine Learning', level: 'EXPERT' },
  { name: 'FSM Deterministic', category: 'Architecture & Design', level: 'EXPERT' },
  { name: 'n8n', category: 'Workflow Automation', level: 'INTERMEDIATE' },
  { name: 'Vapi', category: 'Voice AI', level: 'EXPERT' },
  { name: 'Socket.io', category: 'Real-time & Networking', level: 'EXPERT' },
  { name: 'Twilio', category: 'Voice & Telephony', level: 'EXPERT' },
  { name: 'Whisper', category: 'Speech-to-Text', level: 'EXPERT' },
  { name: 'Cartesia', category: 'Text-to-Speech', level: 'EXPERT' },
  { name: 'Piper', category: 'Text-to-Speech', level: 'INTERMEDIATE' },
  { name: 'DynamoDB', category: 'Databases', level: 'INTERMEDIATE' },
  { name: 'Supabase', category: 'Databases & BaaS', level: 'EXPERT' },
  { name: 'Voice to Voice', category: 'Voice AI', level: 'EXPERT' },
  { name: 'S3', category: 'Cloud & Storage', level: 'EXPERT' },
] as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  const dry = process.argv.includes('--dry');
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = new PrismaClient({ adapter } as any);

  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@jobagent.local';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`User ${email} not found`);

  console.log(`\n── 1. Managing Projects for ${email} ──`);
  const existing = await prisma.project.findMany({ where: { userId: user.id } });
  console.log(`Found ${existing.length} existing project(s) in database.`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const proj of PROJECTS) {
    const keys = [proj.title, ...proj.aliases].map(norm);
    const match = existing.find((e) => {
      const t = norm(e.title);
      return keys.some((k) => t === k || t.includes(k) || k.includes(t));
    });

    if (match) {
      console.log(`UPDATE "${proj.title}" (matched existing "${match.title}")`);
      if (!dry) {
        await prisma.project.update({
          where: { id: match.id },
          data: {
            title: proj.title,
            description: proj.description,
            techStack: proj.techStack,
            highlights: proj.highlights,
            tags: proj.tags,
            isPublic: true,
          },
        });
      }
      updatedCount++;
    } else {
      console.log(`CREATE "${proj.title}"`);
      if (!dry) {
        await prisma.project.create({
          data: {
            userId: user.id,
            title: proj.title,
            description: proj.description,
            techStack: proj.techStack,
            highlights: proj.highlights,
            tags: proj.tags,
            isPublic: true,
          },
        });
      }
      createdCount++;
    }
  }

  console.log(`\n── 2. Syncing Skills Pool (Zero Duplicates) ──`);
  let skillsAdded = 0;
  for (const s of SKILLS_TO_SEED) {
    const existingSkill = await prisma.skill.findUnique({
      where: { userId_name: { userId: user.id, name: s.name } },
    });
    if (!existingSkill) {
      console.log(`ADD SKILL "${s.name}" (${s.category})`);
      if (!dry) {
        await prisma.skill.create({
          data: {
            userId: user.id,
            name: s.name,
            category: s.category,
            level: s.level,
            yearsOfExp: 3,
          },
        });
      }
      skillsAdded++;
    } else {
      console.log(`SKIP SKILL "${s.name}" (already present)`);
    }
  }

  console.log(`\nDone. Projects: ${createdCount} created, ${updatedCount} updated. Skills: ${skillsAdded} added.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
