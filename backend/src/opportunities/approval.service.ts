import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service.js';
import { TailoredCvService } from '../tailored-cv/tailored-cv.service.js';
import { SendDirectEmailDto } from './dto/approval.dto.js';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => TailoredCvService))
    private readonly tailoredCvService: TailoredCvService,
  ) {}

  /** List all opportunities with apply packs awaiting approval */
  async listPending(userId: string) {
    return this.prisma.applyPack.findMany({
      where: { userId, approval: null },
      include: {
        opportunity: {
          include: { requirement: true, match: true },
        },
        approval: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** List all approved/rejected records */
  async listDecided(userId: string) {
    return this.prisma.approvalRecord.findMany({
      where: { userId },
      include: {
        applyPack: {
          include: {
            opportunity: { select: { id: true, title: true, company: true, status: true } },
          },
        },
      },
      orderBy: { decidedAt: 'desc' },
    });
  }

  /** Approve or reject an apply pack */
  async decide(
    applyPackId: string,
    userId: string,
    decision: 'approved' | 'rejected',
    notes?: string,
  ) {
    const pack = await this.prisma.applyPack.findFirst({
      where: { id: applyPackId, userId },
      include: { approval: true },
    });

    if (!pack) throw new NotFoundException('Apply pack not found');
    if (pack.approval) throw new BadRequestException('Already decided');

    const record = await this.prisma.approvalRecord.create({
      data: {
        applyPackId,
        userId,
        decision,
        notes,
      },
    });

    // Update opportunity status
    const newStatus = decision === 'approved' ? 'APPLIED' : 'REJECTED';
    await this.prisma.opportunity.update({
      where: { id: pack.opportunityId },
      data: { status: newStatus },
    });

    this.logger.log(`Pack ${applyPackId} ${decision} by user ${userId}`);
    return record;
  }

  /**
   * Send direct email to recruiter via Resend with verified domain and personal Gmail Reply-To.
   * Attaches tailored CV (PDF) and any uploaded documents, logs ApprovalRecord, marks opportunity as APPLIED.
   */
  async sendDirectEmail(
    applyPackId: string,
    userId: string,
    dto: SendDirectEmailDto,
    files?: Express.Multer.File[],
  ) {
    const pack = await this.prisma.applyPack.findFirst({
      where: { id: applyPackId, userId },
      include: {
        approval: true,
        opportunity: true,
      },
    });

    if (!pack) throw new NotFoundException('Apply pack not found');
    if (pack.approval) throw new BadRequestException('Apply pack has already been decided');

    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('RESEND_API_KEY is not set in backend .env');
    }

    const fromEmail = this.config.get<string>('RESEND_FROM_EMAIL') || 'ghulam@ggitsols.com';
    const replyTo = this.config.get<string>('RESEND_REPLY_TO_EMAIL') || undefined;

    // Fetch candidate profile for Sender Display Name
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const fromName = profile?.fullName || this.config.get<string>('RESEND_FROM_NAME') || 'Ghulam Ghaus';
    const fromHeader = `${fromName} <${fromEmail}>`;

    // Prepare attachments
    const emailAttachments: Array<{ filename: string; content: Buffer }> = [];

    // 1. Attach Tailored CV PDF if requested
    const shouldAttachCv = dto.attachTailoredCv === true || dto.attachTailoredCv === 'true';
    if (shouldAttachCv) {
      try {
        let tailoredCv = await this.prisma.tailoredCv.findFirst({
          where: { opportunityId: pack.opportunityId, userId },
          orderBy: { createdAt: 'desc' },
        });

        if (!tailoredCv) {
          tailoredCv = await this.tailoredCvService.generateTailoredCv(userId, {
            opportunityId: pack.opportunityId,
          });
        }

        if (tailoredCv) {
          const { buffer, filename } = await this.tailoredCvService.renderPdfBuffer(tailoredCv.id, userId);
          emailAttachments.push({
            filename,
            content: buffer,
          });
        }
      } catch (cvErr) {
        this.logger.warn(`Could not attach tailored CV: ${cvErr instanceof Error ? cvErr.message : String(cvErr)}`);
      }
    }

    // 2. Attach any uploaded documents (PDF, DOCX)
    if (files && files.length > 0) {
      for (const file of files) {
        emailAttachments.push({
          filename: file.originalname,
          content: file.buffer,
        });
      }
    }

    // 3. Dispatch via Resend
    const resend = new Resend(apiKey);
    const sendResult = await resend.emails.send({
      from: fromHeader,
      to: [dto.recipientEmail.trim()],
      replyTo: replyTo ? [replyTo.trim()] : undefined,
      subject: dto.subject.trim(),
      text: dto.body,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    });

    if (sendResult.error) {
      this.logger.error(`Resend dispatch error: ${sendResult.error.message}`);
      throw new BadRequestException(`Resend email delivery failed: ${sendResult.error.message}`);
    }

    this.logger.log(
      `Email successfully dispatched to ${dto.recipientEmail} for pack ${applyPackId} (Resend ID: ${sendResult.data?.id})`,
    );

    // 4. Create ApprovalRecord and update Opportunity status to APPLIED
    const approvalNotes = `Dispatched via Resend (${fromHeader} -> ${dto.recipientEmail}) with ${emailAttachments.length} attachment(s). ID: ${sendResult.data?.id}${dto.notes ? ` | Notes: ${dto.notes}` : ''}`;

    const record = await this.prisma.approvalRecord.create({
      data: {
        applyPackId,
        userId,
        decision: 'approved',
        notes: approvalNotes,
      },
    });

    await this.prisma.opportunity.update({
      where: { id: pack.opportunityId },
      data: { status: 'APPLIED' },
    });

    return {
      success: true,
      emailId: sendResult.data?.id,
      recipient: dto.recipientEmail,
      replyTo: replyTo || fromEmail,
      from: fromHeader,
      attachmentsCount: emailAttachments.length,
      approvalRecord: record,
    };
  }
}

