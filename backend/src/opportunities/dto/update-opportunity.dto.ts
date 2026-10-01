import { PartialType } from '@nestjs/swagger';
import { CreateOpportunityDto } from './create-opportunity.dto.js';

export class UpdateOpportunityDto extends PartialType(CreateOpportunityDto) {}
