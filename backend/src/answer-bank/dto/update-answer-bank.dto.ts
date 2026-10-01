import { PartialType } from '@nestjs/swagger';
import { CreateAnswerBankDto } from './create-answer-bank.dto.js';

export class UpdateAnswerBankDto extends PartialType(CreateAnswerBankDto) {}
