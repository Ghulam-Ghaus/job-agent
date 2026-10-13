import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface OutboundVoiceDemoPayload {
  companyId: string;
  companyName: string;
  contactName: string;
  phone: string;
  detectedGap: string;
  proposedSolution: string;
  interactiveDemoUrl: string;
  scriptPrompt: string;
}

@Injectable()
export class OutboundDemoService {
  private readonly logger = new Logger(OutboundDemoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Prepares a personalized interactive demo package for a discovered client lead
   * based on the need-signals extracted by NeedAnalyzerService.
   */
  async prepareDemoPackage(companyId: string): Promise<OutboundVoiceDemoPayload | null> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { contacts: true },
    });

    if (!company) {
      this.logger.warn(`Company ${companyId} not found for demo preparation`);
      return null;
    }

    const primaryContact = company.contacts.find((c) => c.isPrimary) || company.contacts[0];
    const needSignals = (company.needSignalsJson as Array<{ signal: string; evidence: string }>) || [];
    const topGap = needSignals[0]?.signal || 'Operational workflow bottleneck';
    const topEvidence = needSignals[0]?.evidence || 'Automated customer intake and queue management gap';

    const companySlug = company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const interactiveDemoUrl = `https://ggitsols.com/demo/${companySlug}`;

    const scriptPrompt = `You are the outbound consultative demo agent representing Ghulam Ghaus, Forward Deployed Systems Architect.
Target: ${company.name} in ${company.city || 'Riyadh / Dubai'}.
Speaking to: ${primaryContact?.name || 'Managing Director'}.
Core Insight: "We audited your website and identified: ${topGap} (${topEvidence}). Ghulam has architected a bespoke 2-week solution that resolves this bottleneck with automated NestJS queues and instant WhatsApp/Web AI booking. Here is a 30-second live demonstration."`;

    return {
      companyId: company.id,
      companyName: company.name,
      contactName: primaryContact?.name || 'Managing Director',
      phone: primaryContact?.phone || company.phone || '',
      detectedGap: topGap,
      proposedSolution: 'Embedded Forward Deployed Sprint (NestJS + BullMQ + AI Ingestion)',
      interactiveDemoUrl,
      scriptPrompt,
    };
  }
}
