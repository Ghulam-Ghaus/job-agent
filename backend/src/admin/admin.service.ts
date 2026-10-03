import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role, AuditAction } from '../generated/prisma/enums.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all registered users and their operational metrics.
   */
  async getUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        profile: { select: { fullName: true, headline: true } },
        _count: {
          select: {
            opportunities: true,
            applyPacks: true,
            companies: true,
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      slug: u.slug,
      twoFactorEnabled: u.twoFactorEnabled,
      fullName: u.profile?.fullName || null,
      headline: u.profile?.headline || null,
      createdAt: u.createdAt,
      stats: {
        opportunities: u._count.opportunities,
        applyPacks: u._count.applyPacks,
        leads: u._count.companies,
      },
    }));
  }

  /**
   * Update user role or active status.
   */
  async updateUser(
    id: string,
    data: { role?: Role; isActive?: boolean; slug?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        role: data.role,
        isActive: data.isActive,
        slug: data.slug ? data.slug.toLowerCase().trim() : undefined,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        slug: true,
      },
    });
  }

  /**
   * Aggregate LLM usage, cost tracking, token metrics, and recent call audit.
   */
  async getLlmMetrics() {
    const [
      totalCalls,
      totals,
      cachedCalls,
      errorCalls,
      providerGroup,
      modelGroup,
      recentCalls,
    ] = await Promise.all([
      this.prisma.llmCall.count(),
      this.prisma.llmCall.aggregate({
        _sum: {
          tokensIn: true,
          tokensOut: true,
          costUsd: true,
        },
        _avg: {
          durationMs: true,
        },
      }),
      this.prisma.llmCall.count({ where: { cached: true } }),
      this.prisma.llmCall.count({ where: { status: 'error' } }),
      this.prisma.llmCall.groupBy({
        by: ['provider'],
        _count: { id: true },
      }),
      this.prisma.llmCall.groupBy({
        by: ['model'],
        _count: { id: true },
      }),
      this.prisma.llmCall.findMany({
        take: 25,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalTokensIn = totals._sum.tokensIn || 0;
    const totalTokensOut = totals._sum.tokensOut || 0;
    const totalCostUsd = totals._sum.costUsd || 0;
    const avgLatencyMs = Math.round(totals._avg.durationMs || 0);
    const cacheHitRate = totalCalls > 0 ? Math.round((cachedCalls / totalCalls) * 100) : 0;

    return {
      summary: {
        totalCalls,
        totalTokensIn,
        totalTokensOut,
        totalCostUsd: Number(totalCostUsd.toFixed(4)),
        avgLatencyMs,
        cacheHitRate,
        errorCalls,
      },
      providers: providerGroup.map((p) => ({
        provider: p.provider,
        count: p._count.id,
      })),
      models: modelGroup.map((m) => ({
        model: m.model,
        count: m._count.id,
      })),
      recentCalls,
    };
  }

  /**
   * Fetch system audit trail with user email.
   */
  async getAuditLogs(action?: AuditAction, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: action ? { action } : undefined,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, role: true } },
      },
    });
  }

  /**
   * Get operational status of all data ingestion connectors.
   */
  async getSourcesStatus() {
    const [emailJobs, atsJobs, placesLeads, manualJobs] = await Promise.all([
      this.prisma.opportunity.count({ where: { sourceType: 'EMAIL' } }),
      this.prisma.opportunity.count({ where: { sourceType: 'ATS' } }),
      this.prisma.company.count({ where: { placeId: { not: null } } }),
      this.prisma.opportunity.count({ where: { sourceType: 'MANUAL' } }),
    ]);

    const hasImapConfig = Boolean(
      process.env.JOBALERTS_IMAP_USER && process.env.JOBALERTS_IMAP_APP_PASSWORD,
    );
    const hasPlacesConfig = Boolean(process.env.GOOGLE_PLACES_API_KEY);

    return {
      sources: [
        {
          id: 'imap_email',
          name: 'Dedicated Gmail IMAP Connector',
          type: 'EMAIL',
          status: hasImapConfig ? 'HEALTHY' : 'NOT_CONFIGURED',
          metrics: { ingestedCount: emailJobs },
          details: hasImapConfig
            ? `Host: ${process.env.JOBALERTS_IMAP_HOST || 'imap.gmail.com'}`
            : 'Set JOBALERTS_IMAP_USER and JOBALERTS_IMAP_APP_PASSWORD in .env',
        },
        {
          id: 'public_ats',
          name: 'Greenhouse & Lever Public ATS Connector',
          type: 'ATS',
          status: 'HEALTHY',
          metrics: { ingestedCount: atsJobs },
          details: 'Public boards API polling with 1 req/sec rate limit',
        },
        {
          id: 'google_places',
          name: 'Google Places API (New) Direct Clients',
          type: 'PLACES',
          status: hasPlacesConfig ? 'HEALTHY' : 'MOCK_FALLBACK',
          metrics: { discoveredCount: placesLeads },
          details: hasPlacesConfig
            ? 'API key active with 500 calls/mo quota guard'
            : 'Using fail-soft curated business mock provider',
        },
        {
          id: 'manual_clipper',
          name: 'Manual URL / Text Import & Browser Clipper',
          type: 'MANUAL',
          status: 'HEALTHY',
          metrics: { importedCount: manualJobs },
          details: 'Active for all job board URLs and browser clipper inputs',
        },
      ],
    };
  }
}
