import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class GenerateScreeningAnswersDto {
  @ApiProperty({
    description: 'List of screening or application questions from HR/ATS portal',
    example: ['Why are you applying to the Builders Program at Tamara?', 'Please provide details of any internships or projects you completed'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  questions!: string[];
}
