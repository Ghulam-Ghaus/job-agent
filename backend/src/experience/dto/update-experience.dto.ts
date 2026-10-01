import { PartialType } from '@nestjs/swagger';
import { CreateExperienceDto } from './create-experience.dto.js';

export class UpdateExperienceDto extends PartialType(CreateExperienceDto) {}
