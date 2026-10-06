import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OpportunitiesService } from './opportunities.service.js';
import { CreateOpportunityDto } from './dto/create-opportunity.dto.js';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto.js';
import { DecideApprovalDto, UpdateCoverNoteDto } from './dto/approval.dto.js';
import { GenerateScreeningAnswersDto } from './dto/screening-answers.dto.js';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';
import { ApplyPackService } from './apply-pack.service.js';
import { ApprovalService } from './approval.service.js';

@ApiTags('Opportunities')
@ApiCookieAuth('accessToken')
@Controller('opportunities')
export class OpportunitiesController {
  constructor(
    private readonly opportunitiesService: OpportunitiesService,
    private readonly applyPackService: ApplyPackService,
    private readonly approvalService: ApprovalService,
  ) {}

  // ─── Approval Queue (Must precede :id routes to prevent shadowing) ─────────

  @Get('queue/pending')
  @ApiOperation({ summary: 'List all packs awaiting approval' })
  listPending(@CurrentUser('id') userId: string) {
    return this.approvalService.listPending(userId);
  }

  @Get('queue/decided')
  @ApiOperation({ summary: 'List all approved/rejected records' })
  listDecided(@CurrentUser('id') userId: string) {
    return this.approvalService.listDecided(userId);
  }

  @Post('queue/:packId/decide')
  @ApiOperation({ summary: 'Approve or reject an apply pack' })
  decide(
    @Param('packId') packId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvalService.decide(packId, userId, dto.decision, dto.notes);
  }

  // ─── Opportunities CRUD & Actions ──────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Ingest a job opportunity → auto extract + score' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateOpportunityDto) {
    return this.opportunitiesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all my opportunities with match scores' })
  findAll(@CurrentUser('id') userId: string) {
    return this.opportunitiesService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single opportunity with requirement & match' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.opportunitiesService.findOne(id, userId);
  }

  @Post(':id/reprocess')
  @ApiOperation({ summary: 'Re-run extraction + scoring on an existing opportunity' })
  reprocess(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.opportunitiesService.reprocess(id, userId);
  }

  @Post(':id/override-filter')
  @ApiOperation({ summary: 'Override eligibility filter: restores status to QUALIFIED and calculates score' })
  overrideFilter(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.opportunitiesService.overrideFilter(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update opportunity fields (status, title, etc.)' })
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunitiesService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an opportunity' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.opportunitiesService.remove(id, userId);
  }

  // ─── Apply Packs ──────────────────────────────────────────────────────────

  @Post(':id/apply-pack')
  @ApiOperation({ summary: 'Generate a two-pass apply pack (cover note + verification)' })
  buildPack(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.applyPackService.buildPack(id, userId);
  }

  @Get(':id/apply-pack')
  @ApiOperation({ summary: 'Get the apply pack for an opportunity' })
  getPack(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.applyPackService.getPack(id, userId);
  }

  @Patch(':id/apply-pack/cover-note')
  @ApiOperation({ summary: 'Edit the cover note before approval' })
  updateCoverNote(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCoverNoteDto,
  ) {
    return this.applyPackService.updateCoverNote(id, userId, dto.coverNoteEdited);
  }

  @Post(':id/screening-answers')
  @ApiOperation({ summary: 'Generate grounded answers for custom HR/ATS screening questions' })
  generateScreeningAnswers(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateScreeningAnswersDto,
  ) {
    return this.applyPackService.generateScreeningAnswers(id, userId, dto.questions);
  }
}
