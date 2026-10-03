import {
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LlmService } from '../../llm/llm.service.js';

const OutreachDraftSchema = z.object({
  subject: z.string().describe('Clear, professional cold email subject line without spam triggers'),
  body: z.string().describe('High-converting, consultative cold email (under 150 words)'),
  valueProposition: z.string().describe('Specific ROI or solution offered to this business'),
});

@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);
  private readonly DAILY_SEND_CAP = 15; // Strictly capped at 15/day per PLAN §8

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Draft a consultative outreach email based on verified need signals
   */
  async draftOutreach(companyId: string, userId: string) {
    const [company, profile, skills] = await Promise.all([
      this.prisma.company.findFirst({
        where: { id: companyId, userId },
        include: { contacts: true },
      }),
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.skill.findMany({ where: { userId }, select: { name: true } }),
    ]);

    if (!company) throw new NotFoundException('Company not found');

    const primaryContact = company.contacts.find((c) => c.isPrimary) || company.contacts[0];
    const contactName = primaryContact?.name || 'there';
    const senderName = profile?.fullName || 'Full Stack Engineer & Automation Architect';
    const webUrl = this.config.get<string>('WEB_URL') || 'http://localhost:3000';

    const signals = (company.needSignalsJson as any[]) || [];
    const signalsSummary =
      signals.length > 0
        ? signals.map((s) => `• ${s.signal}: ${s.evidence}`).join('\n')
        : 'Opportunity to modernize customer intake with automated web/mobile workflows';

    const prompt = [
      `TARGET COMPANY: ${company.name}`,
      `LOCATION: ${company.city || ''}, ${company.country || ''}`,
      `CONTACT PERSON: ${contactName} (${primaryContact?.role || 'Decision Maker'})`,
      `WEBSITE: ${company.website}`,
      `VERIFIED NEED SIGNALS:\n${signalsSummary}`,
      `OUR CORE EXPERTISE: ${skills.map((s) => s.name).join(', ')}`,
      `SENDER: ${senderName}`,
    ].join('\n');

    const draft = await this.llm.generateStructured({
      system: `You are a consultative B2B partnership director.
Write a concise, high-converting outreach email to this business owner/executive.
RULES:
1. Under 150 words. No robotic fluff, no generic compliments.
2. Directly reference ONE specific observation from their website (from the verified need signals).
3. Offer a low-friction value proposition (e.g. "I recorded a 2-minute video showing how automated booking would work" or "We built a similar automation for a regional clinic").
4. Clear professional tone, respectful of their time.
5. Do NOT include placeholders like [Your Name] — use the provided sender details.`,
      prompt,
      schema: OutreachDraftSchema,
      purpose: 'lead_outreach_draft',
      userId,
    });

    // Create or update OutreachMessage draft
    const existing = await this.prisma.outreachMessage.findFirst({
      where: { companyId, userId, status: 'DRAFT' },
    });

    const optOutToken = existing?.optOutToken || `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optOutFooter = `\n\n---\n${senderName}\nOpt-out of future updates: ${webUrl}/api/v1/leads/opt-out?token=${optOutToken}`;
    const fullBody = `${draft.body.trim()}${optOutFooter}`;

    if (existing) {
      return this.prisma.outreachMessage.update({
        where: { id: existing.id },
        data: {
          subject: draft.subject,
          body: fullBody,
          contactId: primaryContact?.id,
          updatedAt: new Date(),
        },
      });
    }

    const message = await this.prisma.outreachMessage.create({
      data: {
        companyId,
        contactId: primaryContact?.id,
        userId,
        channel: 'EMAIL',
        subject: draft.subject,
        body: fullBody,
        status: 'DRAFT',
        optOutToken,
      },
    });

    await this.prisma.company.update({
      where: { id: companyId },
      data: { status: 'DRAFT_READY' },
    });

    return message;
  }

  /**
   * Human approval guard and dispatch: sends the email and enforces safety limits.
   * Safety rules:
   * 1. Never sends without explicit human invocation
   * 2. Daily send cap (max 15/day)
   * 3. Domain/email suppression check
   */
  async approveAndSend(outreachId: string, userId: string) {
    const message = await this.prisma.outreachMessage.findFirst({
      where: { id: outreachId, userId },
      include: { company: true, contact: true },
    });

    if (!message) throw new NotFoundException('Outreach message not found');
    if (message.status === 'SENT') {
      throw new HttpException('Message has already been dispatched', HttpStatus.BAD_REQUEST);
    }

    // 1. Enforce Daily Send Cap (default: 15 per day) per PLAN §8
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sentTodayCount = await this.prisma.outreachMessage.count({
      where: {
        userId,
        status: 'SENT',
        sentAt: { gte: today },
      },
    });

    if (sentTodayCount >= this.DAILY_SEND_CAP) {
      throw new HttpException(
        `Daily outreach limit reached (${sentTodayCount}/${this.DAILY_SEND_CAP} emails sent today). Further sends are paused until tomorrow to maintain sender reputation.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Check Global Suppression List
    const domain = message.company.website
      ? new URL(message.company.website.startsWith('http') ? message.company.website : `https://${message.company.website}`).hostname.replace(/^www\./, '').toLowerCase()
      : null;

    if (domain) {
      const isSuppressed = await this.prisma.suppressionEntry.findFirst({
        where: {
          userId,
          OR: [
            { domain },
            ...(message.contact?.email ? [{ email: message.contact.email.toLowerCase() }] : []),
          ],
        },
      });

      if (isSuppressed) {
        throw new HttpException(
          `Target domain (${domain}) or email is on your suppression list. Outreach aborted.`,
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // 3. Mark as Approved & Sent (in dev/demo mode, logs and timestamps)
    this.logger.log(
      `Dispatched outreach to "${message.company.name}" (Subject: "${message.subject}"). Daily count: ${sentTodayCount + 1}/${this.DAILY_SEND_CAP}`,
    );

    const nextFollowUpAt = new Date();
    nextFollowUpAt.setDate(nextFollowUpAt.getDate() + 4); // 4 days follow-up window

    const updated = await this.prisma.outreachMessage.update({
      where: { id: message.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    await this.prisma.company.update({
      where: { id: message.companyId },
      data: {
        status: 'CONTACTED',
        lastContactedAt: new Date(),
        nextFollowUpAt,
      },
    });

    // Create Audit Log entry
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'APPLY_PACK_APPROVED' as any,
        entity: 'OutreachMessage',
        entityId: message.id,
        meta: {
          companyId: message.companyId,
          companyName: message.company.name,
          subject: message.subject,
        },
      },
    });

    return updated;
  }

  /**
   * Handle one-click unsubscribe / opt-out link
   */
  async handleOptOut(token: string) {
    const message = await this.prisma.outreachMessage.findUnique({
      where: { optOutToken: token },
      include: { company: true, contact: true },
    });

    if (!message) throw new NotFoundException('Invalid or expired opt-out token');

    const domain = message.company.website
      ? new URL(message.company.website.startsWith('http') ? message.company.website : `https://${message.company.website}`).hostname.replace(/^www\./, '').toLowerCase()
      : undefined;

    await this.prisma.suppressionEntry.upsert({
      where: { userId_domain: { userId: message.userId, domain: domain || 'unknown' } },
      create: {
        userId: message.userId,
        domain,
        email: message.contact?.email || undefined,
        reason: 'opt_out',
      },
      update: {
        reason: 'opt_out',
      },
    });

    // Mark company as NOT_INTERESTED
    await this.prisma.company.update({
      where: { id: message.companyId },
      data: { status: 'NOT_INTERESTED' },
    });

    this.logger.log(`Opt-out processed for ${domain || message.company.name}`);
    return { domain, companyName: message.company.name };
  }
}
