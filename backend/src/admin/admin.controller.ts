import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiResponse } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { Roles } from '../auth/decorators/roles/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard.js';
import { Role, AuditAction } from '../generated/prisma/enums.js';

@ApiTags('Super Admin')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all platform users with activity stats' })
  @ApiResponse({ status: 200, description: 'List of users' })
  getUsers() {
    return this.adminService.getUsers();
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user role or active status' })
  @ApiResponse({ status: 200, description: 'User updated' })
  updateUser(
    @Param('id') id: string,
    @Body() body: { role?: Role; isActive?: boolean; slug?: string },
  ) {
    return this.adminService.updateUser(id, body);
  }

  @Get('llm-usage')
  @ApiOperation({ summary: 'Get aggregated LLM metrics, token usage, and costs' })
  @ApiResponse({ status: 200, description: 'LLM metrics summary' })
  getLlmMetrics() {
    return this.adminService.getLlmMetrics();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get recent system audit logs' })
  @ApiResponse({ status: 200, description: 'List of audit logs' })
  getAuditLogs(
    @Query('action') action?: AuditAction,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAuditLogs(
      action,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('sources')
  @ApiOperation({ summary: 'Get status and health of all ingestion sources' })
  @ApiResponse({ status: 200, description: 'Ingestion sources status' })
  getSources() {
    return this.adminService.getSourcesStatus();
  }
}
