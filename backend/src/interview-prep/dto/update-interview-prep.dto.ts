import { PartialType } from '@nestjs/swagger';
import { CreateInterviewPrepDto } from './create-interview-prep.dto.js';

export class UpdateInterviewPrepDto extends PartialType(CreateInterviewPrepDto) {}
