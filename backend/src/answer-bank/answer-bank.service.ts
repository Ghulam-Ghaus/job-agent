import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAnswerBankDto } from './dto/create-answer-bank.dto.js';
import { UpdateAnswerBankDto } from './dto/update-answer-bank.dto.js';

@Injectable()
export class AnswerBankService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateAnswerBankDto) {
    return this.prisma.answerBankItem.create({
      data: { userId, question: dto.question, answer: dto.answer, tags: dto.tags ?? [] },
    });
  }

  findAll(userId: string) {
    return this.prisma.answerBankItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const item = await this.prisma.answerBankItem.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException(`AnswerBankItem ${id} not found`);
    return item;
  }

  async update(id: string, userId: string, dto: UpdateAnswerBankDto) {
    await this.findOne(id, userId);
    return this.prisma.answerBankItem.update({ where: { id }, data: dto as object });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.answerBankItem.delete({ where: { id } });
  }
}
