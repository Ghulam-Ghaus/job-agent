import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { OpportunityType } from '../../generated/prisma/index.js';

export class CreateOpportunityDto {
  @ApiPropertyOptional() @IsOptional() @IsString() text?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() url?: string;
  @ApiPropertyOptional({ enum: OpportunityType }) @IsOptional() @IsEnum(OpportunityType) type?: OpportunityType;
}

