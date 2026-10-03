import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InterviewPrepService } from './interview-prep.service.js';
import {
  GenerateInterviewPrepDto,
  ToggleTaskDto,
} from './dto/create-interview-prep.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';

@ApiTags('Interview Prep')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('interview-prep')
export class InterviewPrepController {
  constructor(private readonly interviewPrepService: InterviewPrepService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a role-based interview preparation & learning roadmap' })
  generate(
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateInterviewPrepDto,
  ) {
    return this.interviewPrepService.generatePrep(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all interview preparation plans' })
  list(
    @CurrentUser('id') userId: string,
    @Query('opportunityId') opportunityId?: string,
  ) {
    return this.interviewPrepService.listPreps(userId, opportunityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific interview prep plan' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.interviewPrepService.getPrep(id, userId);
  }

  @Patch(':id/tasks/:taskId/toggle')
  @ApiOperation({ summary: 'Toggle completion status of a hands-on interview practice task' })
  toggleTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ToggleTaskDto,
  ) {
    return this.interviewPrepService.toggleTask(id, taskId, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an interview prep plan' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.interviewPrepService.deletePrep(id, userId);
  }
}
