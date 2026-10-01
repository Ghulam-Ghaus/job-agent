import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateExperienceDto } from './dto/create-experience.dto.js';
import { UpdateExperienceDto } from './dto/update-experience.dto.js';

@Injectable()
export class ExperienceService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateExperienceDto) {
    const plain = Object.assign({}, dto);
    return this.prisma.experience.create({
      // oxlint-disable-next-line typescript/no-misused-spread
      data: { userId, ...plain, startDate: new Date(dto.startDate), endDate: dto.endDate ? new Date(dto.endDate) : null },
    });
  }

  findAll(userId: string) {
    return this.prisma.experience.findMany({
      where: { userId },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
    });
  }

  async findOne(userId: string, id: string) {
    const exp = await this.prisma.experience.findFirst({ where: { id, userId } });
    if (!exp) throw new NotFoundException('Experience not found');
    return exp;
  }

  async update(userId: string, id: string, dto: UpdateExperienceDto) {
    await this.findOne(userId, id);
    return this.prisma.experience.update({
      where: { id },
      data: {
        // oxlint-disable-next-line typescript/no-misused-spread
        ...Object.assign({}, dto),
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.experience.delete({ where: { id } });
  }
}

