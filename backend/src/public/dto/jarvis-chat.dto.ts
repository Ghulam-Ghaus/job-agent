import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class ChatMessageItemDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsString()
  role!: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  content!: string;
}

export class JarvisChatDto {
  @ApiProperty({
    example: 'Explain your BullMQ queue architecture',
    description: 'User or client question to the JARVIS voice/text agent',
  })
  @IsString()
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional({
    type: [ChatMessageItemDto],
    description: 'Previous messages in the conversation',
  })
  @IsOptional()
  @IsArray()
  history?: ChatMessageItemDto[];

  @ApiPropertyOptional({
    example: 'session_123',
    description: 'Client session identifier for conversation continuity',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
