import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';

@ApiTags('Projects')
@ApiCookieAuth('accessToken')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post() @ApiOperation({ summary: 'Add a project' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(userId, dto);
  }

  @Get() @ApiOperation({ summary: 'List all my projects' })
  findAll(@CurrentUser('id') userId: string) {
    return this.projectsService.findAll(userId);
  }

  @Get(':id') @ApiOperation({ summary: 'Get one project' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.projectsService.findOne(userId, id);
  }

  @Patch(':id') @ApiOperation({ summary: 'Update a project' })
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(userId, id, dto);
  }

  @Delete(':id') @ApiOperation({ summary: 'Delete a project' })
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.projectsService.remove(userId, id);
  }
}

