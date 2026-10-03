import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlacesService, PlaceBusiness } from '../connectors/places/places.service.js';
import { NeedAnalyzerService } from './need-analyzer/need-analyzer.service.js';
import { OutreachService } from './outreach/outreach.service.js';
import { LeadStatus } from '../generated/prisma/enums.js';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly places: PlacesService,
    private readonly needAnalyzer: NeedAnalyzerService,
    private readonly outreach: OutreachService,
  ) {}

  /**
   * Discover candidate businesses via Google Places API (New) with quota protection
   */
  async discover(userId: string, query: string, locationBias?: string) {
    return this.places.searchBusinesses(userId, query, locationBias);
  }

  /**
   * Import a discovered business as a Lead, analyze its website need signals,
   * and auto-draft outreach if qualification score >= 80.
   */
  async importLead(userId: string, place: PlaceBusiness) {
    this.logger.log(`Importing business "${place.name}" for user ${userId}`);

    // Upsert company
    const company = await this.prisma.company.upsert({
      where: {
        userId_placeId: {
          userId,
          placeId: place.placeId,
        },
      },
      create: {
        userId,
        placeId: place.placeId,
        name: place.name,
        website: place.website,
        phone: place.phone,
        address: place.address,
        city: place.city,
        country: place.country,
        businessType: place.businessType,
        status: LeadStatus.RESEARCHING,
      },
      update: {
        name: place.name,
        website: place.website,
        phone: place.phone,
        address: place.address,
        businessType: place.businessType,
      },
    });

    // Create primary contact placeholder
    const existingContact = await this.prisma.contact.findFirst({
      where: { companyId: company.id },
    });
    if (!existingContact) {
      await this.prisma.contact.create({
        data: {
          companyId: company.id,
          name: `${place.name} Operations / Leadership`,
          role: 'Decision Maker',
          phone: place.phone,
          isPrimary: true,
        },
      });
    }

    // Analyze website need-signals if website exists
    if (place.website) {
      try {
        const analysis = await this.needAnalyzer.analyzeWebsite(
          place.website,
          place.name,
          userId,
        );

        const newStatus =
          analysis.qualificationScore >= 60 ? LeadStatus.QUALIFIED : LeadStatus.RESEARCHING;

        const updated = await this.prisma.company.update({
          where: { id: company.id },
          data: {
            qualificationScore: analysis.qualificationScore,
            needSignalsJson: analysis.signals as any,
            notes: analysis.summary,
            status: newStatus,
          },
          include: { contacts: true, outreachMessages: true },
        });

        // Auto-draft outreach if qualification score >= 80
        if (analysis.qualificationScore >= 80) {
          try {
            await this.outreach.draftOutreach(company.id, userId);
          } catch (draftErr) {
            this.logger.warn(`Could not auto-draft outreach for ${company.name}: ${String(draftErr)}`);
          }
        }

        return updated;
      } catch (err) {
        this.logger.error(`Website analysis failed for ${place.name}: ${String(err)}`);
      }
    }

    return this.prisma.company.findUnique({
      where: { id: company.id },
      include: { contacts: true, outreachMessages: true },
    });
  }

  /**
   * List all companies / leads for this user with filtering and search
   */
  async findAll(
    userId: string,
    filter?: { status?: LeadStatus; search?: string },
  ) {
    const where: any = { userId };
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { city: { contains: filter.search, mode: 'insensitive' } },
        { businessType: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.company.findMany({
      where,
      include: {
        contacts: true,
        outreachMessages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ qualificationScore: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get single lead by ID
   */
  async findOne(id: string, userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, userId },
      include: {
        contacts: true,
        outreachMessages: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!company) throw new NotFoundException('Lead company not found');
    return company;
  }

  /**
   * Update lead status, notes, or next follow-up date
   */
  async update(id: string, userId: string, data: { status?: LeadStatus; notes?: string; nextFollowUpAt?: Date }) {
    await this.findOne(id, userId);
    return this.prisma.company.update({
      where: { id },
      data: {
        status: data.status,
        notes: data.notes,
        nextFollowUpAt: data.nextFollowUpAt,
      },
      include: { contacts: true, outreachMessages: true },
    });
  }

  /**
   * Delete a lead company
   */
  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.company.delete({ where: { id } });
  }

  /**
   * List user's suppression entries
   */
  async getSuppressions(userId: string) {
    return this.prisma.suppressionEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Add a domain or email to suppression list
   */
  async addSuppression(userId: string, domain?: string, email?: string, reason = 'manual') {
    const cleanDomain = domain?.toLowerCase().replace(/^(?:https?:\/\/)?(?:www\.)?/, '').split('/')[0];
    return this.prisma.suppressionEntry.upsert({
      where: { userId_domain: { userId, domain: cleanDomain || 'unknown' } },
      create: {
        userId,
        domain: cleanDomain,
        email: email?.toLowerCase(),
        reason,
      },
      update: {
        email: email?.toLowerCase(),
        reason,
      },
    });
  }

  /**
   * Remove a domain/email from suppression list
   */
  async removeSuppression(id: string, userId: string) {
    return this.prisma.suppressionEntry.deleteMany({
      where: { id, userId },
    });
  }
}
