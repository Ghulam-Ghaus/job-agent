import { Module } from '@nestjs/common';
import { PreferencesService } from './preferences.service.js';
import { PreferencesController } from './preferences.controller.js';

@Module({
  controllers: [PreferencesController],
  providers: [PreferencesService],
})
export class PreferencesModule {}
