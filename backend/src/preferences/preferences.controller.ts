import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PreferencesService } from './preferences.service.js';
import { CreatePreferenceDto } from './dto/create-preference.dto.js';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';

@ApiTags('Preferences')
@ApiCookieAuth('accessToken')
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get my job preferences' })
  findOne(@CurrentUser('id') userId: string) {
    return this.preferencesService.findOne(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Create or update my job preferences' })
  upsert(@CurrentUser('id') userId: string, @Body() dto: CreatePreferenceDto) {
    return this.preferencesService.upsert(userId, dto);
  }
}
