import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public/public.decorator.js';
import { PublicService } from './public.service.js';
import { JarvisChatDto } from './dto/jarvis-chat.dto.js';
import { RecordQueryDto } from './dto/record-query.dto.js';

@ApiTags('Public Showcase')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Public()
  @Get('profile')
  @ApiOperation({ summary: 'Get default primary public consultant portfolio profile' })
  @ApiResponse({ status: 200, description: 'Sanitized public profile' })
  getDefaultProfile() {
    return this.publicService.getPublicProfile();
  }

  @Public()
  @Get('profile/:slug')
  @ApiOperation({ summary: 'Get public portfolio profile by developer/consultant slug' })
  @ApiResponse({ status: 200, description: 'Sanitized public profile' })
  getProfileBySlug(@Param('slug') slug: string) {
    return this.publicService.getPublicProfile(slug);
  }

  @Public()
  @Get('products')
  @ApiOperation({ summary: 'Get productized engineering offerings and architectural solutions' })
  @ApiResponse({ status: 200, description: 'List of productized offerings' })
  getProducts() {
    return this.publicService.getPublicProducts();
  }

  @Public()
  @Get('telemetry')
  @ApiOperation({ summary: 'Get real-time operational system telemetry and worker health' })
  @ApiResponse({ status: 200, description: 'Live system telemetry metrics' })
  getTelemetry() {
    return this.publicService.getPublicTelemetry();
  }

  @Public()
  @Post('inquiry')
  @ApiOperation({ summary: 'Submit client project inquiry or consultation request' })
  @ApiResponse({ status: 201, description: 'Inquiry registered' })
  submitInquiry(
    @Body()
    body: {
      name: string;
      email: string;
      company?: string;
      message: string;
      productSlug?: string;
    },
  ) {
    return this.publicService.submitInquiry(body);
  }

  @Public()
  @Post('jarvis/chat')
  @ApiOperation({ summary: 'Conversational JARVIS voice & MCP tool execution agent' })
  @ApiResponse({ status: 200, description: 'Grounded JARVIS speech response and tool execution actions' })
  askJarvis(@Body() body: JarvisChatDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || undefined;
    const ua = (req.headers['user-agent'] as string) || undefined;
    return this.publicService.askJarvis(body, ip, ua);
  }

  @Public()
  @Post('jarvis/query')
  @ApiOperation({ summary: 'Record a client query and response from voice or text interaction' })
  @ApiResponse({ status: 201, description: 'Client query recorded successfully' })
  recordClientQuery(@Body() body: RecordQueryDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || undefined;
    const ua = (req.headers['user-agent'] as string) || undefined;
    return this.publicService.recordClientQuery(body, ip, ua);
  }

  @Public()
  @Throttle({ short: { limit: 2, ttl: 1000 }, long: { limit: 6, ttl: 60_000 } })
  @Get('voice/token')
  @ApiOperation({ summary: 'Mint a short-lived session token for the real-time voice agent' })
  @ApiResponse({ status: 200, description: 'Short-lived voice session token' })
  @ApiResponse({ status: 429, description: 'Too many token requests' })
  @ApiResponse({ status: 503, description: 'Voice agent unavailable' })
  getVoiceToken() {
    return this.publicService.getVoiceToken();
  }
}

