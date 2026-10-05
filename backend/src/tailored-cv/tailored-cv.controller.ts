import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { TailoredCvService } from './tailored-cv.service.js';
import {
  AddSkillFromGapDto,
  GenerateCoverLetterDto,
  GenerateTailoredCvDto,
} from './dto/create-tailored-cv.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';

@ApiTags('Tailored CV')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('tailored-cv')
export class TailoredCvController {
  constructor(private readonly tailoredCvService: TailoredCvService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a tailored, verified CV for a job or role' })
  generate(
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateTailoredCvDto,
  ) {
    return this.tailoredCvService.generateTailoredCv(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all generated tailored CVs' })
  list(
    @CurrentUser('id') userId: string,
    @Query('opportunityId') opportunityId?: string,
  ) {
    return this.tailoredCvService.listTailoredCvs(userId, opportunityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tailored CV content by ID' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.tailoredCvService.getTailoredCv(id, userId);
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Download ATS-friendly tailored CV as PDF (Gulf or European layout)',
    description:
      'Layout resolves from ?style=GULF|EUROPE, else the saved CV style preference, else the opportunity location.',
  })
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
    @Query('style') style?: string,
  ) {
    const { buffer, filename, style: used } = await this.tailoredCvService.renderPdfBuffer(
      id,
      userId,
      style,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-CV-Style', used);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  @Post('add-skill-from-gap')
  @ApiOperation({ summary: 'Add a verified skill gap to Master Profile in 1-click and re-score opportunity' })
  addSkillFromGap(
    @CurrentUser('id') userId: string,
    @Body() dto: AddSkillFromGapDto,
  ) {
    return this.tailoredCvService.addSkillFromGap(userId, dto);
  }

  @Post('cover-letter')
  @ApiOperation({ summary: 'Generate a tailored, JD-matched cover letter for an opportunity' })
  generateCoverLetter(
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateCoverLetterDto,
  ) {
    return this.tailoredCvService.generateCoverLetter(userId, dto);
  }

  @Get('cover-letter/:id/download')
  @ApiOperation({ summary: 'Download tailored cover letter as PDF' })
  async downloadCoverLetterPdf(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.tailoredCvService.renderCoverLetterPdf(id, userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
}
