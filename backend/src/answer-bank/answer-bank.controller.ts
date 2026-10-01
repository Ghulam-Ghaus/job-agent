import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnswerBankService } from './answer-bank.service.js';
import { CreateAnswerBankDto } from './dto/create-answer-bank.dto.js';
import { UpdateAnswerBankDto } from './dto/update-answer-bank.dto.js';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';

@ApiTags('Answer Bank')
@ApiCookieAuth('accessToken')
@Controller('answer-bank')
export class AnswerBankController {
  constructor(private readonly answerBankService: AnswerBankService) {}

  @Post()
  @ApiOperation({ summary: 'Add a Q&A pair to the answer bank' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateAnswerBankDto) {
    return this.answerBankService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all Q&A pairs' })
  findAll(@CurrentUser('id') userId: string) {
    return this.answerBankService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single Q&A pair' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.answerBankService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a Q&A pair' })
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateAnswerBankDto,
  ) {
    return this.answerBankService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a Q&A pair' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.answerBankService.remove(id, userId);
  }
}
