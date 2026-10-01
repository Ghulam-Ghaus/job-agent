import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkillsService } from './skills.service.js';
import { CreateSkillDto } from './dto/create-skill.dto.js';
import { UpdateSkillDto } from './dto/update-skill.dto.js';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';

@ApiTags('Skills')
@ApiCookieAuth('accessToken')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Post() @ApiOperation({ summary: 'Add or update a skill (upsert by name)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateSkillDto) {
    return this.skillsService.create(userId, dto);
  }

  @Get() @ApiOperation({ summary: 'List all my skills' })
  findAll(@CurrentUser('id') userId: string) {
    return this.skillsService.findAll(userId);
  }

  @Patch(':id') @ApiOperation({ summary: 'Update a skill' })
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateSkillDto) {
    return this.skillsService.update(userId, id, dto);
  }

  @Delete(':id') @ApiOperation({ summary: 'Delete a skill' })
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.skillsService.remove(userId, id);
  }
}

