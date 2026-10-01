import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { extractText } from 'unpdf';
import * as mammoth from 'mammoth';
import { z } from 'zod';
import { LlmService } from '../../llm/llm.service.js';

export const ParsedCvSchema = z.object({
  profile: z.object({
    fullName: z.string().optional().default(''),
    headline: z.string().optional().default(''),
    summary: z.string().optional().default(''),
    phone: z.string().optional().default(''),
    location: z.string().optional().default(''),
    country: z.string().optional().default(''),
    linkedinUrl: z.string().optional().default(''),
    githubUrl: z.string().optional().default(''),
    portfolioUrl: z.string().optional().default(''),
    visaStatus: z.string().optional().default(''),
    noticePeriodDays: z.number().int().optional().default(0),
    willingToRelocate: z.boolean().optional().default(false),
  }),
  skills: z
    .array(
      z.object({
        name: z.string(),
        level: z.enum(['BEGINNER', 'INTERMEDIATE', 'EXPERT']).default('INTERMEDIATE'),
        yearsOfExp: z.number().optional().default(1),
        category: z.string().optional().default('General'),
      }),
    )
    .default([]),
  experiences: z
    .array(
      z.object({
        title: z.string(),
        company: z.string(),
        location: z.string().optional().default(''),
        startDate: z.string().default('2020-01'),
        endDate: z.string().optional(),
        isCurrent: z.boolean().default(false),
        bullets: z.array(z.string()).default([]),
        techStack: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  preferences: z
    .object({
      targetRoles: z.array(z.string()).default([]),
      targetCountries: z.array(z.string()).default([]),
      minSalaryUsd: z.number().optional(),
      remoteOk: z.boolean().default(true),
      preferredIndustries: z.array(z.string()).default([]),
    })
    .default({
      targetRoles: [],
      targetCountries: [],
      remoteOk: true,
      preferredIndustries: [],
    }),
});

export type ParsedCvData = z.infer<typeof ParsedCvSchema>;

@Injectable()
export class CvParserService {
  private readonly logger = new Logger(CvParserService.name);

  constructor(private readonly llmService: LlmService) {}

  /** Extract raw text from PDF or DOCX buffer */
  async extractRawText(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      if (mimeType === 'application/pdf') {
        const { text } = await extractText(new Uint8Array(buffer));
        const combined = Array.isArray(text) ? text.join('\n\n') : String(text);
        if (!combined.trim()) {
          throw new BadRequestException('The uploaded PDF appears to be empty or an unreadable scan.');
        }
        return combined.trim();
      }

      if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword'
      ) {
        const result = await mammoth.extractRawText({ buffer });
        if (!result.value.trim()) {
          throw new BadRequestException('The uploaded Word document appears to be empty.');
        }
        return result.value.trim();
      }

      throw new BadRequestException(`Unsupported MIME type for text extraction: ${mimeType}`);
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Document text extraction failed: ${msg}`);
      throw new BadRequestException(`Failed to extract text from document: ${msg}`);
    }
  }

  /** Parse raw CV text using LLM into structured profile data */
  async parseCv(buffer: Buffer, mimeType: string, userId?: string): Promise<ParsedCvData> {
    const rawText = await this.extractRawText(buffer, mimeType);

    this.logger.log(`Parsing CV text (${rawText.length} chars) using LLM...`);

    const parsed = await this.llmService.generateStructured({
      purpose: 'cv_onboarding_extraction',
      userId,
      system:
        'You are an expert CV parser and career advisor. Extract structured, 100% accurate profile information from the resume text into the requested schema. Never invent facts. For skills, infer level and category accurately. For experiences, extract title, company, dates (in YYYY-MM format), key achievement bullets, and mentioned tech stack. For targetRoles and targetCountries in preferences, infer likely desired roles and target countries based on their experience and background.',
      prompt: `CV Text:\n\n${rawText.slice(0, 15000)}\n\nExtract all profile fields, skills, work experience entries, and preferences.`,
      schema: ParsedCvSchema,
    });

    return parsed;
  }
}
