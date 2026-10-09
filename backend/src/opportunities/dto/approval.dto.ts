import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class DecideApprovalDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsEnum(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCoverNoteDto {
  @ApiProperty()
  @IsString()
  coverNoteEdited!: string;
}

export class SendDirectEmailDto {
  @ApiProperty({ example: 'recruiter@company.com' })
  @IsString()
  recipientEmail!: string;

  @ApiProperty({ example: 'Application: Senior Backend Engineer - Ghulam Ghaus' })
  @IsString()
  subject!: string;

  @ApiProperty({ example: 'Hi Sarah,\n\nI am writing to express my interest in...' })
  @IsString()
  body!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  attachTailoredCv?: boolean | string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

