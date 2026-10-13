import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordQueryDto {
  @ApiProperty({
    example: 'What services do you offer?',
    description: 'Query asked by the client or visitor',
  })
  @IsString()
  @MaxLength(2000)
  query!: string;

  @ApiPropertyOptional({
    example: 'We offer autonomous enterprise AI agents...',
    description: 'Spoken or written response provided to the client',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  response?: string;

  @ApiProperty({
    enum: ['TEXT', 'VOICE'],
    default: 'VOICE',
    description: 'Channel through which the question was asked',
  })
  @IsIn(['TEXT', 'VOICE'])
  channel: 'TEXT' | 'VOICE' = 'VOICE';

  @ApiPropertyOptional({
    example: 'switch_tab',
    description: 'Action executed by Ghaus in the UI',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    example: 'query_service_catalog',
    description: 'Tool invoked during reasoning',
  })
  @IsOptional()
  @IsString()
  toolName?: string;

  @ApiPropertyOptional({
    example: 24,
    description: 'Execution or round-trip latency in milliseconds',
  })
  @IsOptional()
  @IsNumber()
  latencyMs?: number;

  @ApiPropertyOptional({
    example: 'sess_123',
    description: 'Client session ID',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Extra client or telemetry metadata',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
