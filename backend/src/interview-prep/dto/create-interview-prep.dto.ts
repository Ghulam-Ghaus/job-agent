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

export type CoachMode = 'standard' | 'short' | 'deep_technical' | 'simple_english' | 'bullet_points';

export class InterviewCoachDto {
  @ApiPropertyOptional({ description: 'Interview question to answer and prepare for', example: 'What is the difference between Authentication and Authorization?' })
  @IsString()
  question!: string;

  @ApiPropertyOptional({
    description: 'Style/mode of the answer',
    enum: ['standard', 'short', 'deep_technical', 'simple_english', 'bullet_points'],
    default: 'standard',
  })
  @IsOptional()
  @IsString()
  mode?: CoachMode;

  @ApiPropertyOptional({ description: 'Target job role (optional, defaults to profile headline)' })
  @IsOptional()
  @IsString()
  targetRole?: string;

  @ApiPropertyOptional({ description: 'User comment or refinement instruction (e.g. "make it punchier", "emphasize my FSM work")' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Previous answer text when requesting iterative refinement' })
  @IsOptional()
  @IsString()
  previousAnswer?: string;

  @ApiPropertyOptional({ description: 'Force regeneration bypassing cache' })
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}
