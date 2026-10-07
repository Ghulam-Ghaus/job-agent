import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';

export class UpdateOutreachStatusDto {
  @ApiProperty({ enum: ['not_sent', 'sent', 'replied'] })
  @IsEnum(['not_sent', 'sent', 'replied'])
  status!: 'not_sent' | 'sent' | 'replied';
}

export class GenerateOutreachPackDto {
  @ApiPropertyOptional({ description: 'Minimum score threshold to generate outreach pack (default: 70)' })
  @IsOptional()
  @IsNumber()
  scoreThreshold?: number;
}
