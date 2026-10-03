import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public/public.decorator.js';
import { PublicService } from './public.service.js';

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
}
