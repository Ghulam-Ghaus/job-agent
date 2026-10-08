import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class AtsTargetDto {
  @ApiPropertyOptional({ enum: ['greenhouse', 'lever', 'ashby', 'workable'] })
  @IsIn(['greenhouse', 'lever', 'ashby', 'workable'])
  platform!: 'greenhouse' | 'lever' | 'ashby' | 'workable';

  @ApiPropertyOptional({ description: 'Company board slug, e.g. "careem"' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,80}$/, { message: 'slug may only contain letters, numbers, - and _' })
  slug!: string;
}

export class CreatePreferenceDto {
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) targetRoles?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) targetCountries?: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) minSalaryUsd?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() remoteOk?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) blacklistCompanies?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) blacklistKeywords?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) preferredIndustries?: string[];

  @ApiPropertyOptional({ type: [AtsTargetDto], description: 'Greenhouse/Lever company boards to poll' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtsTargetDto)
  atsTargets?: AtsTargetDto[];

  @ApiPropertyOptional({ type: [String], description: 'Only ingest ATS jobs whose location matches one of these' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locationFilters?: string[];

  @ApiPropertyOptional({ enum: ['AUTO', 'GULF', 'EUROPE'] })
  @IsOptional()
  @IsIn(['AUTO', 'GULF', 'EUROPE'])
  cvStyle?: 'AUTO' | 'GULF' | 'EUROPE';
}
