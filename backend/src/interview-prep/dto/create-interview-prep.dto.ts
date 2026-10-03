import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateInterviewPrepDto {
  @ApiPropertyOptional({ description: 'ID of opportunity to prepare for (optional)' })
  @IsOptional()
  @IsString()
  opportunityId?: string;

  @ApiPropertyOptional({ example: 'Senior Backend Engineer', description: 'Target role name' })
  @IsOptional()
  @IsString()
  targetRole?: string;

  @ApiPropertyOptional({ description: 'Optional raw job description or skills needed' })
  @IsOptional()
  @IsString()
  jobDescription?: string;

  @ApiPropertyOptional({ description: 'Specific areas to focus on (e.g. System Design, SQL)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusAreas?: string[];

  @ApiPropertyOptional({ description: 'Bypass cache and force regenerate' })
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}

export class CreateInterviewPrepDto extends GenerateInterviewPrepDto {}

export class ToggleTaskDto {
  @ApiPropertyOptional({ description: 'Explicit done status, or omitted to flip' })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
