import { PartialType } from '@nestjs/swagger';
import { CreateTailoredCvDto } from './create-tailored-cv.dto.js';

export class UpdateTailoredCvDto extends PartialType(CreateTailoredCvDto) {}
