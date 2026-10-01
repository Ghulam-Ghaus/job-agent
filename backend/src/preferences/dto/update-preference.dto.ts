import { PartialType } from '@nestjs/swagger';
import { CreatePreferenceDto } from './create-preference.dto.js';

export class UpdatePreferenceDto extends PartialType(CreatePreferenceDto) {}
