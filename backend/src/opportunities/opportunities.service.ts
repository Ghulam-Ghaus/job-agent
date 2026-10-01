import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOpportunityDto } from './dto/create-opportunity.dto.js';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto.js';

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Manually ingest an opportunity. Dedup by content hash. */
  create(userId: string, dto: CreateOpportunityDto) {
    const rawText = dto.text ?? dto.url ?? '';
    const contentHash = createHash('sha256').update(rawText).digest('hex');

    return this.prisma.opportunity.upsert({
      where: { userId_contentHash: { userId, contentHash } },
      create: {
        userId,
        contentHash,
        rawText,
        url: dto.url,
        type: dto.type,
        sourceType: 'MANUAL',
      },
      update: {}, // idempotent — already ingested
    });
  }

  findAll(userId: string) {
    return this.prisma.opportunity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { requirement: true, match: true },
    });
  }

  async findOne(id: string, userId: string) {
    const opp = await this.prisma.opportunity.findFirst({
      where: { id, userId },
      include: { requirement: true, match: true },
    });
    if (!opp) throw new NotFoundException(`Opportunity ${id} not found`);
    return opp;
  }

  async update(id: string, userId: string, dto: UpdateOpportunityDto) {
    await this.findOne(id, userId);
    return this.prisma.opportunity.update({ where: { id }, data: dto as object });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.opportunity.delete({ where: { id } });
  }
}
