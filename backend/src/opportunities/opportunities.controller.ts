import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OpportunitiesService } from './opportunities.service.js';
import { CreateOpportunityDto } from './dto/create-opportunity.dto.js';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto.js';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';

@ApiTags('Opportunities')
@ApiCookieAuth('accessToken')
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Post()
  @ApiOperation({ summary: 'Manually ingest an opportunity (deduped by content hash)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateOpportunityDto) {
    return this.opportunitiesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all my opportunities' })
  findAll(@CurrentUser('id') userId: string) {
    return this.opportunitiesService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single opportunity with requirement & match' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.opportunitiesService.findOne(id, userId);
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
}
