import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { LlmService } from '../../llm/llm.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export const NeedSignalItemSchema = z.object({
  signal: z.string().describe('Identified gap or need, e.g. "No online booking", "Outdated mobile site", "Missing AI assistant"'),
  category: z.enum([
    'BOOKING_SYSTEM',
    'AI_ASSISTANT',
    'MODERN_STACK',
    'MOBILE_PERF',
    'SEO_CONTENT',
    'CUSTOM_AUTOMATION',
  ]),
  evidence: z.string().describe('Exact quote or observation from the website text proving this need'),
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  recommendation: z.string().describe('Specific tech solution we can build for them'),
});

export const NeedAnalysisSchema = z.object({
  qualificationScore: z.number().int().min(0).max(100).describe('0-100 score based on severity of needs and client potential'),
  summary: z.string().describe('1-2 sentence executive summary of the business technical gaps'),
  signals: z.array(NeedSignalItemSchema),
  suggestedAngle: z.string().describe('Best consultative conversation starter for cold outreach'),
});

export type NeedSignalItem = z.infer<typeof NeedSignalItemSchema>;
export type NeedAnalysisResult = z.infer<typeof NeedAnalysisSchema>;

@Injectable()
export class NeedAnalyzerService {
  private readonly logger = new Logger(NeedAnalyzerService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Politely fetch public homepage and analyze it for actionable technical need-signals.
   */
  async analyzeWebsite(
    websiteUrl: string,
    companyName: string,
    userId: string,
  ): Promise<NeedAnalysisResult> {
    this.logger.log(`Analyzing need signals for "${companyName}" (${websiteUrl})...`);

    // 1. Fetch public website content politely
    const rawContent = await this.politeFetchWebsite(websiteUrl);

    // 2. Fetch candidate skills/profile to anchor recommendations
    const [profile, skills] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.skill.findMany({ where: { userId }, select: { name: true, level: true } }),
    ]);

    const skillsContext = skills.map((s) => s.name).join(', ') || 'Next.js, NestJS, TypeScript, AI Automation, PostgreSQL';
    const candidateName = profile?.fullName || 'Full Stack Engineer & AI Systems Architect';

    // 3. AI Need-Signal Analysis with strict evidence rules
    const prompt = [
      `TARGET BUSINESS: ${companyName}`,
      `WEBSITE URL: ${websiteUrl}`,
      `OUR CORE CAPABILITIES: ${skillsContext}`,
      `CONSULTANT: ${candidateName}`,
      `\nPUBLIC WEBSITE CONTENT EXTRACT:\n${rawContent.slice(0, 7500)}`,
    ].join('\n');

    const result = await this.llm.generateStructured({
      system: `You are a consultative B2B software engineering and automation auditor.
Your job is to identify legitimate, high-value technical gaps and business improvement opportunities on a business's public website.
RULES:
1. Every identified signal MUST have verbatim or factual evidence from the provided website content. Do NOT hallucinate features they already have.
2. Focus on high-value business wins:
   - Missing automated online booking or reservation system (e.g. asking users to call during business hours instead of instant booking)
   - Lack of 24/7 AI customer service / chatbot for lead capture
   - Outdated static presentation lacking customer portal or interactive workflows
   - Slow or poor modern mobile UX signals
3. Provide an honest qualification score:
   - 80-100: Multiple clear, high-severity gaps where modern software would directly drive revenue.
   - 60-79: Moderate gaps, worth a targeted conversation.
   - < 60: Minimal obvious gaps or modern site already in place.
4. Return strict JSON matching the schema.`,
      prompt,
      schema: NeedAnalysisSchema,
      purpose: 'lead_need_analysis',
      userId,
    });

    this.logger.log(
      `Analysis for "${companyName}" complete: Score ${result.qualificationScore}/100, found ${result.signals.length} need-signals`,
    );

    return result;
  }

  /**
   * Politely fetch public website text content with timeout, headers, and robots.txt check.
   */
  private async politeFetchWebsite(url: string): Promise<string> {
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;

    try {
      const urlObj = new URL(formattedUrl);

      // Check robots.txt politely
      try {
        const robotsUrl = `${urlObj.origin}/robots.txt`;
        const robotsRes = await fetch(robotsUrl, {
          signal: AbortSignal.timeout(2500),
          headers: { 'User-Agent': 'JobAgentBot/1.0 (+http://localhost:3000/bot-info)' },
        });

        if (robotsRes.ok) {
          const robotsTxt = await robotsRes.text();
          if (robotsTxt.includes('Disallow: /') && !robotsTxt.includes('Disallow: /wp-admin')) {
            this.logger.warn(`robots.txt disallows root for ${urlObj.origin}; respecting directive.`);
            return `Website: ${formattedUrl}. Note: Full automated crawl restricted by robots.txt; heuristic review used.`;
          }
        }
      } catch {
        // robots.txt unreachable, proceed with polite single-page fetch
      }

      // Fetch homepage with 5s timeout
      const response = await fetch(formattedUrl, {
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 JobAgent/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        return `Website ${formattedUrl} returned HTTP status ${response.status}. Basic presence detected.`;
      }

      const html = await response.text();

      // Clean HTML to readable text
      const cleanText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return cleanText || `Website ${formattedUrl} loaded with minimal plain text.`;
    } catch (err: unknown) {
      this.logger.warn(`Could not reach ${formattedUrl} directly (${String(err)}). Using fallback descriptor.`);
      return `Website ${formattedUrl}: Business website identified via Google Places. Site could not be fetched directly within timeout; analyze based on business domain standards.`;
    }
  }
}
