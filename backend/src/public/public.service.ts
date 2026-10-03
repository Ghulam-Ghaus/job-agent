import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from '../generated/prisma/enums.js';

export interface PublicProfileDto {
  name: string;
  headline: string;
  summary: string;
  location: string;
  country: string | null;
  slug: string;
  skills: Array<{
    name: string;
    level: string;
    category?: string | null;
    yearsOfExp?: number | null;
  }>;
  projects: Array<{
    id: string;
    title: string;
    description: string | null;
    techStack: unknown;
    url: string | null;
    repoUrl: string | null;
    highlights: unknown;
    featured: boolean;
  }>;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
}

@Injectable()
export class PublicService implements OnModuleInit {
  private readonly logger = new Logger(PublicService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultShowcase();
  }

  /**
   * Return strictly whitelisted public profile. Excludes phone, exact addresses, internal scores.
   */
  async getPublicProfile(slug?: string): Promise<PublicProfileDto> {
    const user = slug
      ? await this.prisma.user.findFirst({
          where: { slug: slug.toLowerCase(), isActive: true },
          include: {
            profile: true,
            skills: { orderBy: { level: 'desc' } },
            projects: { where: { isPublic: true }, orderBy: { createdAt: 'desc' } },
          },
        })
      : await this.prisma.user.findFirst({
          where: { role: Role.SUPER_ADMIN, isActive: true },
          include: {
            profile: true,
            skills: { orderBy: { level: 'desc' } },
            projects: { where: { isPublic: true }, orderBy: { createdAt: 'desc' } },
          },
        });

    if (!user) {
      throw new NotFoundException('Public profile not found');
    }

    const p = user.profile;

    return {
      name: p?.fullName || 'Ghulam Ghaus',
      headline: p?.headline || 'Senior Full Stack & AI Systems Architect',
      summary:
        p?.summary ||
        'Specializing in autonomous agentic pipelines, high-concurrency NestJS services, and modern Next.js user interfaces.',
      location: p?.location || 'Riyadh / Dubai / Remote',
      country: p?.country || 'Saudi Arabia',
      slug: user.slug || 'ghulam-ghaus',
      skills: (user.skills || []).map((s) => ({
        name: s.name,
        level: s.level,
        category: s.category,
        yearsOfExp: s.yearsOfExp,
      })),
      projects: (user.projects || []).map((proj) => ({
        id: proj.id,
        title: proj.title,
        description: proj.description,
        techStack: proj.techStack,
        url: proj.url,
        repoUrl: proj.repoUrl,
        highlights: proj.highlights,
        featured: proj.featured,
      })),
      githubUrl: p?.githubUrl || 'https://github.com/Ghulam-Ghaus',
      linkedinUrl: p?.linkedinUrl || 'https://linkedin.com/in/ghulam-ghaus',
      portfolioUrl: p?.portfolioUrl || 'https://ggitsols.com',
    };
  }

  /**
   * Return public productized offerings.
   */
  async getPublicProducts() {
    return this.prisma.product.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        tagline: true,
        description: true,
        category: true,
        features: true,
        priceUsd: true,
        priceModel: true,
        demoUrl: true,
        badge: true,
      },
    });
  }

  /**
   * Handle public client service inquiry and register prospective lead.
   */
  async submitInquiry(data: {
    name: string;
    email: string;
    company?: string;
    message: string;
    productSlug?: string;
  }) {
    // Find super admin to assign lead to
    const admin = await this.prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
    });

    if (admin) {
      const company = await this.prisma.company.create({
        data: {
          userId: admin.id,
          name: data.company || `${data.name}'s Company`,
          status: 'QUALIFIED',
          qualificationScore: 88,
          notes: `Public inquiry via portfolio showcase:\nEmail: ${data.email}\nProduct: ${
            data.productSlug || 'General'
          }\nMessage: ${data.message}`,
          needSignalsJson: [
            {
              signal: 'Direct Portfolio Inquiry',
              evidence: data.message.slice(0, 150),
              severity: 'HIGH',
            },
          ],
        },
      });

      await this.prisma.contact.create({
        data: {
          companyId: company.id,
          name: data.name,
          email: data.email,
          isPrimary: true,
          role: 'Inquirer',
        },
      });
    }

    return {
      success: true,
      message: 'Thank you! Your project inquiry has been received. We will respond within 24 hours.',
    };
  }

  /**
   * Seed initial portfolio products and ensure super admin has slug.
   */
  private async seedDefaultShowcase() {
    try {
      const admin = await this.prisma.user.findFirst({
        where: { role: Role.SUPER_ADMIN },
      });

      if (!admin) return;

      if (!admin.slug) {
        await this.prisma.user.update({
          where: { id: admin.id },
          data: { slug: 'ghulam-ghaus' },
        });
      }

      const count = await this.prisma.product.count();
      if (count === 0) {
        await this.prisma.product.createMany({
          data: [
            {
              userId: admin.id,
              slug: 'ai-agentic-pipeline',
              title: 'Autonomous AI Agentic Pipeline',
              tagline: 'End-to-end data ingestion, LLM reasoning, and queue orchestration.',
              description:
                'Production-grade agent architecture leveraging BullMQ, Redis, PostgreSQL, and multi-tier LLMs with strict evidence verification.',
              category: 'AI_AUTOMATION',
              features: [
                'Multi-channel ingestion (IMAP, Webhooks, APIs)',
                'Zod-validated structured reasoning',
                'Human-in-the-loop approval workflows',
                'Cost-guard rate limiters and token auditing',
              ],
              priceUsd: 2500,
              priceModel: 'FIXED',
              badge: 'POPULAR',
              isPublic: true,
            },
            {
              userId: admin.id,
              slug: 'enterprise-fullstack-starter',
              title: 'Enterprise Next.js 15 & NestJS Architecture',
              tagline: 'Ultra-fast, type-safe full stack application blueprint.',
              description:
                'Clean architecture with NestJS REST APIs, Prisma 7, PostgreSQL, Next.js App Router, shadcn/ui, and automated CI/CD.',
              category: 'FULLSTACK_APP',
              features: [
                'HTTP-only cookie JWT + Refresh + 2FA security',
                'Strict micro-service/monolith folder structure',
                'Dark-mode native Tailwind & Radix UI design',
                'Zero-warning strict TypeScript typechecks',
              ],
              priceUsd: 1800,
              priceModel: 'FIXED',
              badge: 'FEATURED',
              isPublic: true,
            },
            {
              userId: admin.id,
              slug: 'lead-outreach-engine',
              title: 'Direct Client Discovery & CRM Engine',
              tagline: 'Google Places API discovery and need-signal website analysis.',
              description:
                'Automated discovery of local and global businesses, polite robots.txt site crawling, need-signal extraction, and consultative outreach drafting.',
              category: 'AGENT_PIPELINE',
              features: [
                'Google Places API (New) with FieldMask optimization',
                'Polite site scraper with evidence quoting',
                '15/day safety send cap & global domain suppression',
                'One-click recipient opt-out system',
              ],
              priceUsd: 3200,
              priceModel: 'FIXED',
              badge: 'NEW',
              isPublic: true,
            },
          ],
        });
        this.logger.log('Seeded default public showcase products');
      }
    } catch (e: unknown) {
      this.logger.warn(`Could not seed default showcase: ${(e as Error).message}`);
    }
  }
}
