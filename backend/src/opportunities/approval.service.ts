import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(private readonly prisma: PrismaService) {}

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
}
