import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LanguageEntryDto {
  @IsString()
  language: string;

  @IsString()
  level: string; // e.g. Native, Fluent, Conversational
}

export class CreateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  headline?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  summary?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  location?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  country?: string;

  @ApiPropertyOptional() @IsOptional() @IsUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsUrl()
  githubUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsUrl()
  portfolioUrl?: string;

  @ApiPropertyOptional({ type: [LanguageEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LanguageEntryDto)
  languages?: LanguageEntryDto[];

  @ApiPropertyOptional() @IsOptional() @IsString()
  visaStatus?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  noticePeriodDays?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  willingToRelocate?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  relocationCountries?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString()
  telegramChatId?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  onboardingDone?: boolean;
}

