import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { SkillLevel } from '../../generated/prisma/index.js';

export class CreateSkillDto {
  @ApiProperty() @IsString() @MaxLength(80) name: string;
  @ApiPropertyOptional({ enum: SkillLevel }) @IsOptional() @IsEnum(SkillLevel) level?: SkillLevel;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) yearsOfExp?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
}

