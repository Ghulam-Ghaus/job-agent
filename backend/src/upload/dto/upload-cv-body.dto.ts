import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadCvBodyDto {
  @ApiProperty({ example: 'Backend NodeJS' })
  @IsString()
  @MaxLength(80)
  label: string;

  /**
   * Tags come from multipart form as comma-separated string or repeated fields.
   * Transform handles both formats.
   */
  @ApiPropertyOptional({ type: [String], example: ['nodejs', 'backend'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
    return value;
  })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  isDefault?: boolean;
}
