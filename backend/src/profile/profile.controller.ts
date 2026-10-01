import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProfileService } from './profile.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';

@ApiTags('Profile')
@ApiCookieAuth('accessToken')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get my profile (creates empty one if missing)' })
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.profileService.findOrCreate(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Create or update my profile' })
  upsertProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.upsert(userId, dto);
  }
}

