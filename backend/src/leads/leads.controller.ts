import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { LeadsService } from './leads.service.js';
import { PlacesService } from '../connectors/places/places.service.js';
import { OutreachService } from './outreach/outreach.service.js';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';
import { Public } from '../auth/decorators/public/public.decorator.js';
import { LeadStatus } from '../generated/prisma/enums.js';

@ApiTags('Leads')
@ApiCookieAuth('accessToken')
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly placesService: PlacesService,
    private readonly outreachService: OutreachService,
  ) {}

  // ─── Discovery & Quota ──────────────────────────────────────────────────────

  @Post('discover')
  @ApiOperation({ summary: 'Discover prospective businesses via Google Places API (New)' })
  discover(
    @CurrentUser('id') userId: string,
    @Body() body: { query: string; locationBias?: string },
  ) {
    return this.leadsService.discover(userId, body.query, body.locationBias);
  }

  @Get('quota')
  @ApiOperation({ summary: 'Get monthly Google Places API calls and cost metrics' })
  getQuota(@CurrentUser('id') userId: string) {
    return this.placesService.getMonthlyUsage(userId);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import discovered business and analyze website need-signals' })
  importLead(
    @CurrentUser('id') userId: string,
    @Body() body: any,
  ) {
    return this.leadsService.importLead(userId, body);
  }

  // ─── Suppression & Opt-Out (Precedes :id routes) ───────────────────────────

  @Get('suppressions')
  @ApiOperation({ summary: 'List all suppressed domains and emails' })
  getSuppressions(@CurrentUser('id') userId: string) {
    return this.leadsService.getSuppressions(userId);
  }

  @Post('suppressions')
  @ApiOperation({ summary: 'Add a domain or email to suppression list' })
  addSuppression(
    @CurrentUser('id') userId: string,
    @Body() body: { domain?: string; email?: string; reason?: string },
  ) {
    return this.leadsService.addSuppression(userId, body.domain, body.email, body.reason);
  }

  @Delete('suppressions/:id')
  @ApiOperation({ summary: 'Remove an entry from the suppression list' })
  removeSuppression(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.leadsService.removeSuppression(id, userId);
  }

  @Public()
  @Get('opt-out')
  @ApiOperation({ summary: 'One-click email recipient opt-out endpoint' })
  async optOut(@Query('token') token: string) {
    const res = await this.outreachService.handleOptOut(token);
    return {
      message: `You have successfully unsubscribed. No further messages will be sent to ${res.domain || res.companyName}.`,
    };
  }

  // ─── Outreach Actions ──────────────────────────────────────────────────────

  @Post(':id/draft-outreach')
  @ApiOperation({ summary: 'Draft a consultative outreach email based on verified need signals' })
  draftOutreach(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.outreachService.draftOutreach(id, userId);
  }

  @Post('outreach/:outreachId/send')
  @ApiOperation({ summary: 'Approve and dispatch cold outreach email (enforcing daily cap)' })
  approveAndSend(
    @CurrentUser('id') userId: string,
    @Param('outreachId') outreachId: string,
  ) {
    return this.outreachService.approveAndSend(outreachId, userId);
  }

  // ─── CRUD Pipeline ─────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all client leads for user' })
  findAll(
    @CurrentUser('id') userId: string,
    @Query('status') status?: LeadStatus,
    @Query('search') search?: string,
  ) {
    return this.leadsService.findAll(userId, { status, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a lead company' })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.leadsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead status or notes' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { status?: LeadStatus; notes?: string; nextFollowUpAt?: string },
  ) {
    return this.leadsService.update(id, userId, {
      status: body.status,
      notes: body.notes,
      nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : undefined,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete lead' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.leadsService.remove(id, userId);
  }
}
