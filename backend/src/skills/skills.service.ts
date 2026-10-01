import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSkillDto } from './dto/create-skill.dto.js';
import { UpdateSkillDto } from './dto/update-skill.dto.js';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateSkillDto) {
    return this.prisma.skill.upsert({
      where: { userId_name: { userId, name: dto.name } },
      // oxlint-disable-next-line typescript/no-misused-spread
      create: { userId, ...Object.assign({}, dto) },
      update: Object.assign({}, dto),
    });
  }

  findAll(userId: string) {
    return this.prisma.skill.findMany({ where: { userId }, orderBy: { name: 'asc' } });
  }

  async findOne(userId: string, id: string) {
    const skill = await this.prisma.skill.findFirst({ where: { id, userId } });
    if (!skill) throw new NotFoundException('Skill not found');
    return skill;
  }

  async update(userId: string, id: string, dto: UpdateSkillDto) {
    await this.findOne(userId, id);
    return this.prisma.skill.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.skill.delete({ where: { id } });
  }
}

