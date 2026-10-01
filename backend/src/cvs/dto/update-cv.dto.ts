import { PartialType } from '@nestjs/swagger';
import { CreateCvDto } from './create-cv.dto.js';

export class UpdateCvDto extends PartialType(CreateCvDto) {}
