import { Module } from '@nestjs/common';
import { AnswerBankService } from './answer-bank.service.js';
import { AnswerBankController } from './answer-bank.controller.js';

@Module({
  controllers: [AnswerBankController],
  providers: [AnswerBankService],
})
export class AnswerBankModule {}
