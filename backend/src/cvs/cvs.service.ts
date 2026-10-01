import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCvDto } from './dto/create-cv.dto.js';
import { UpdateCvDto } from './dto/update-cv.dto.js';

@Injectable()
export class CvsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a CV metadata record (actual file stored separately). */
  create(userId: string, dto: CreateCvDto, fileInfo: { filename: string; storagePath: string; mimeType: string; sizeBytes: number }) {
    return this.prisma.cv.create({
      data: {
        userId,
        label: dto.label,
        tags: dto.tags ?? [],
        isDefault: dto.isDefault ?? false,
        ...fileInfo,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.cv.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, userId: string) {
    const cv = await this.prisma.cv.findFirst({ where: { id, userId } });
    if (!cv) throw new NotFoundException(`CV ${id} not found`);
    return cv;
  }

  async update(id: string, userId: string, dto: UpdateCvDto) {
    await this.findOne(id, userId);
    return this.prisma.cv.update({ where: { id }, data: dto as object });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.cv.delete({ where: { id } });
  }
}
