import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

/** Serialize a DTO that may contain typed objects into plain-JSON-compatible shape for Prisma Json fields. */
function toPlain<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, dto: UpdateProfileDto) {
    const data = toPlain(dto);
    return this.prisma.profile.upsert({
      where: { userId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { userId, ...(data as any) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: data as any,
    });
  }

  async findOrCreate(userId: string) {
    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
}
