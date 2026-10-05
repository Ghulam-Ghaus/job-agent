import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Idempotent import of production projects into the Master Profile.
 * Facts below are copied from the owner's own project descriptions — nothing is invented.
 * A project is skipped if an existing one matches by normalized title or alias.
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
    title: 'Voice Intake System',
    aliases: ['voice intake', 'ai voice intake'],
    description:
      'AI-driven voice intake and scheduling platform for the legal industry, designed to handle live phone calls with low-latency audio streaming. Built conversational agents for call qualification and automated booking, with a scalable multi-tenant backend integrating STT/TTS pipelines, Supabase persistence, and external calendaring services.',
    techStack: ['Python', 'WebSockets', 'Twilio', 'Whisper STT', 'Cartesia TTS', 'Supabase'],
    highlights: [
      'Handles live phone calls with low-latency audio streaming',
      'Conversational agents for call qualification and automated booking',
      'Multi-tenant backend integrating STT/TTS pipelines and external calendaring services',
    ],
    tags: ['AI', 'Voice AI', 'Legal', 'Real-time'],
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

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  const dry = process.argv.includes('--dry');
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = new PrismaClient({ adapter } as any);

  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@jobagent.local';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`User ${email} not found`);

  const existing = await prisma.project.findMany({ where: { userId: user.id } });
  console.log(`Existing projects (${existing.length}):`);
  existing.forEach((p) => console.log(`  - ${p.title}`));

  let created = 0;
  for (const proj of PROJECTS) {
    const keys = [proj.title, ...proj.aliases].map(norm);
    const match = existing.find((e) => {
      const t = norm(e.title);
      return keys.some((k) => t === k || t.includes(k));
    });
    if (match) {
      console.log(`SKIP  "${proj.title}" (matches existing "${match.title}")`);
      continue;
    }
    console.log(`${dry ? 'WOULD ADD' : 'ADD'}  "${proj.title}"`);
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
      created++;
    }
  }
  console.log(`Done. ${dry ? 'Dry run, nothing written.' : `${created} project(s) created.`}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
