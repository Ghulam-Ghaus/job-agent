import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { generateObject, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { LlmProvider } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface StructuredGenerationParams<T> {
  prompt: string;
  system?: string;
  schema: z.ZodType<T>;
  purpose: string;
  userId?: string;
}

interface ModelCandidate {
  providerName: string;
  model: LanguageModel;
  modelName: string;
  llmProvider: LlmProvider;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getChain(): string[] {
    const chainStr = this.configService.get<string>('LLM_CHAIN', 'gemini,groq');
    return chainStr
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  private getCandidatesForProvider(provider: string): ModelCandidate[] {
    if (provider === 'gemini') {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }
      const google = createGoogleGenerativeAI({ apiKey });
      return [
        {
          providerName: 'gemini',
          model: google('gemini-3.8-flash'),
          modelName: 'gemini-3.8-flash',
          llmProvider: LlmProvider.GEMINI,
        },
        {
          providerName: 'gemini',
          model: google('gemini-3.5-flash-lite'),
          modelName: 'gemini-3.5-flash-lite',
          llmProvider: LlmProvider.GEMINI,
        },
      ];
    }

    if (provider === 'groq') {
      const apiKey = this.configService.get<string>('GROQ_API_KEY');
      if (!apiKey) {
        throw new Error('GROQ_API_KEY is not configured');
      }
      const groq = createGroq({ apiKey });
      return [
        {
          providerName: 'groq',
          model: groq('openai/gpt-oss-120b'),
          modelName: 'openai/gpt-oss-120b',
          llmProvider: LlmProvider.GROQ,
        },
        {
          providerName: 'groq',
          model: groq('qwen/qwen3.8-27b'),
          modelName: 'qwen/qwen3.8-27b',
          llmProvider: LlmProvider.GROQ,
        },
      ];
    }

    throw new Error(`Unsupported LLM provider "${provider}"`);
  }

  async generateStructured<T>(params: {
    prompt: string;
    system?: string;
    schema: z.ZodType<T>;
    purpose: string;
    userId?: string;
  }): Promise<T> {
    const { prompt, system, schema, purpose, userId } = params;
    const promptHash = createHash('sha256')
      .update(`${system ?? ''}:::${prompt}`)
      .digest('hex');

    const chain = this.getChain();
    let lastError: Error | null = null;

    for (const provider of chain) {
      let candidates: ModelCandidate[];
      try {
        candidates = this.getCandidatesForProvider(provider);
      } catch (e: unknown) {
        lastError = e instanceof Error ? e : new Error(String(e));
        this.logger.warn(`Failed to initialize provider ${provider}: ${lastError.message}`);
        continue;
      }

      for (const candidate of candidates) {
        const startTime = Date.now();
        try {
          this.logger.log(`Invoking LLM [${candidate.providerName}/${candidate.modelName}] for purpose "${purpose}"`);

          const result = await generateObject({
            model: candidate.model,
            schema,
            system,
            prompt,
          });

          const durationMs = Date.now() - startTime;
          const usage = result.usage as unknown as Record<string, unknown> | undefined;
          const tokensIn =
            typeof usage?.inputTokens === 'number'
              ? usage.inputTokens
              : typeof usage?.promptTokens === 'number'
                ? usage.promptTokens
                : null;
          const tokensOut =
            typeof usage?.outputTokens === 'number'
              ? usage.outputTokens
              : typeof usage?.completionTokens === 'number'
                ? usage.completionTokens
                : null;

          // Audit log call
          await this.prisma.llmCall
            .create({
              data: {
                userId,
                provider: candidate.llmProvider,
                model: candidate.modelName,
                promptHash,
                tokensIn,
                tokensOut,
                durationMs,
                purpose,
                status: 'ok',
              },
            })
            .catch((err) => {
              this.logger.error(`Failed to record LlmCall: ${err.message}`);
            });

          return result.object;
        } catch (err: unknown) {
          const durationMs = Date.now() - startTime;
          const error = err instanceof Error ? err : new Error(String(err));
          lastError = error;
          this.logger.warn(
            `Model "${candidate.modelName}" on "${candidate.providerName}" failed for purpose "${purpose}": ${error.message}. Attempting fallback...`,
          );

          await this.prisma.llmCall
            .create({
              data: {
                userId,
                provider: candidate.llmProvider,
                model: candidate.modelName,
                promptHash,
                durationMs,
                purpose,
                status: 'error',
                errorMsg: error.message,
              },
            })
            .catch(() => {});
        }
      }
    }

    throw new Error(
      `All LLM providers in chain [${chain.join(', ')}] failed. Last error: ${lastError?.message}`,
    );
  }
}
