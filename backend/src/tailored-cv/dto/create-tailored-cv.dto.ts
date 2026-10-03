import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { SkillLevel } from '../../generated/prisma/enums.js';

export class GenerateTailoredCvDto {
  @ApiPropertyOptional({ description: 'ID of opportunity to tailor CV for' })
  @IsOptional()
  @IsString()
  opportunityId?: string;

  @ApiPropertyOptional({ description: 'Target job title/role' })
  @IsOptional()
  @IsString()
  targetRole?: string;

  @ApiPropertyOptional({ description: 'Job description text if no opportunityId' })
  @IsOptional()
  @IsString()
  jobDescription?: string;

  @ApiPropertyOptional({ description: 'Specific skill names to emphasize' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emphasizedSkills?: string[];

  @ApiPropertyOptional({ description: 'Bypass cache and force regenerate' })
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}

export class CreateTailoredCvDto extends GenerateTailoredCvDto {}

export class AddSkillFromGapDto {
  @ApiProperty({ example: 'RESTful APIs', description: 'Skill name to add to profile' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ enum: SkillLevel, default: SkillLevel.INTERMEDIATE })
  @IsOptional()
  @IsEnum(SkillLevel)
  level?: SkillLevel;

  @ApiPropertyOptional({ example: 'Backend', description: 'Skill category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Opportunity ID to re-score after adding skill' })
  @IsOptional()
  @IsString()
  opportunityId?: string;
}

export class GenerateCoverLetterDto {
  @ApiProperty({ description: 'ID of opportunity to generate cover letter for' })
  @IsString()
  @IsNotEmpty()
  opportunityId!: string;

  @ApiPropertyOptional({ description: 'Bypass cache and force regenerate' })
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}

export class UpdateCoverLetterDto {
  @ApiProperty({ description: 'User-edited cover letter content' })
  @IsString()
  @IsNotEmpty()
  bodyEdited!: string;
}
