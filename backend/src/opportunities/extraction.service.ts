import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { LlmService } from '../llm/llm.service.js';

// ─── Extraction schema ────────────────────────────────────────────────────────

const RequirementSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  remote: z.boolean().optional(),
  seniority: z
    .enum(['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'PRINCIPAL', 'EXECUTIVE'])
    .optional(),
  yearsExp: z.number().int().min(0).max(50).optional(),
  skills: z
    .array(
      z.object({
        name: z.string(),
        required: z.boolean(),
        yearsExp: z.number().int().min(0).max(50).optional(),
      }),
    )
    .default([]),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  salaryCurrency: z.string().optional(),
  salaryPeriod: z.enum(['ANNUAL', 'MONTHLY', 'HOURLY']).optional(),
  visaSponsorship: z.boolean().optional(),
  industry: z.string().optional(),
  description: z.string().optional(),
  postedAt: z.string().optional(), // ISO date string from text
  // ── Sprint 3: Freelance Fields ──
  isFreelance: z.boolean().optional(),
  freelanceRateMin: z.number().optional(),
  freelanceRateMax: z.number().optional(),
  freelanceRateType: z.enum(['HOURLY', 'FIXED']).optional(),
  clientPaymentVerified: z.boolean().optional(),
  clientRating: z.number().optional(),
  clientTotalSpent: z.string().optional(),
  proposalsCount: z.string().optional(),
  scopeClarity: z.enum(['CLEAR', 'MODERATE', 'VAGUE']).optional(),
});

const EvidenceSchema = z.record(z.string(), z.string()); // { fieldName: "verbatim quote" }

const ExtractionResultSchema = z.object({
  fields: RequirementSchema,
  evidence: EvidenceSchema,
  model: z.string().optional(),
  promptVersion: z.string().optional(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
export type JobRequirementFields = z.infer<typeof RequirementSchema>;

const PROMPT_VERSION = 'v1';
const SYSTEM_PROMPT = `You are a precise job description parser.
Extract structured information from the raw job posting text.
For every field you extract, include a verbatim quote from the source text as evidence.
If a field is not mentioned, omit it — do NOT invent values.
Skills should list ALL technical and soft skills mentioned.
Return JSON matching the schema exactly.`;

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(private readonly llm: LlmService) { }

  async extractRequirements(
    rawText: string,
    userId?: string,
  ): Promise<ExtractionResult> {
    this.logger.log(`Extracting requirements from text (${rawText.length} chars)`);

    const result = await this.llm.generateStructured({
      system: SYSTEM_PROMPT,
      prompt: `Extract structured job requirements from the following posting:\n\n${rawText.slice(0, 12_000)}`,
      schema: ExtractionResultSchema,
      purpose: 'extraction',
      userId,
    });

    return {
      ...result,
      model: 'llm-service',
      promptVersion: PROMPT_VERSION,
    };
  }
}
