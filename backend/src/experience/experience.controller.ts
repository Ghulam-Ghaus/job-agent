import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExperienceService } from './experience.service.js';
import { CreateExperienceDto } from './dto/create-experience.dto.js';
import { UpdateExperienceDto } from './dto/update-experience.dto.js';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';

@ApiTags('Experience')
@ApiCookieAuth('accessToken')
@Controller('experience')
export class ExperienceController {
  constructor(private readonly experienceService: ExperienceService) {}

  @Post()
  @ApiOperation({ summary: 'Add experience entry' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateExperienceDto) {
    return this.experienceService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all my experience entries' })
  findAll(@CurrentUser('id') userId: string) {
    return this.experienceService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one experience entry' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.experienceService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update experience entry' })
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateExperienceDto) {
    return this.experienceService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete experience entry' })
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.experienceService.remove(userId, id);
  }
}

