import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class DetectAtsDto {
  @ApiProperty({ description: 'Company careers or jobs page URL to analyze', example: 'https://tamara.co/careers' })
  @IsString()
  @IsNotEmpty()
  url!: string;
}

export class AddAtsTargetDto {
  @ApiProperty({ enum: ['greenhouse', 'lever', 'ashby', 'workable'] })
  @IsIn(['greenhouse', 'lever', 'ashby', 'workable'])
  platform!: 'greenhouse' | 'lever' | 'ashby' | 'workable';

  @ApiProperty({ example: 'tamara' })
  @IsString()
  @IsNotEmpty()
  slug!: string;
}
