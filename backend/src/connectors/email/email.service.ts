import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { PipelineService } from '../../queues/pipeline/pipeline.service.js';

export interface EmailSyncResult {
  totalProcessed: number;
  jobsEnqueued: number;
  errors: string[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly pipeline: PipelineService,
  ) {}

  /**
   * Sync job alert emails from the configured IMAP mailbox.
   * Fails soft if credentials are missing or connection fails.
   */
  async syncAlerts(userId: string): Promise<EmailSyncResult> {
    const host = this.config.get<string>('JOBALERTS_IMAP_HOST') || 'imap.gmail.com';
    const user = this.config.get<string>('JOBALERTS_IMAP_USER');
    const pass = this.config.get<string>('JOBALERTS_IMAP_APP_PASSWORD');

    const result: EmailSyncResult = {
      totalProcessed: 0,
      jobsEnqueued: 0,
      errors: [],
    };

    if (!user || !pass) {
      this.logger.warn('IMAP user or app password not configured; skipping email sync');
      return result;
    }

    const client = new ImapFlow({
      host,
      port: 993,
      secure: true,
      auth: { user, pass },
      logger: false,
    });

    try {
      this.logger.log(`Connecting to IMAP mailbox ${host} for user ${user}...`);
      await client.connect();

      const lock = await client.getMailboxLock('INBOX');
      try {
        // Search unread messages
        const messages = client.fetch({ seen: false }, { source: true, uid: true });

        for await (const msg of messages) {
          result.totalProcessed++;
          try {
            if (!msg.source) continue;
            const parsed = await simpleParser(msg.source);
            const enqueued = await this.parseAndEnqueue(parsed, userId);
            if (enqueued > 0) {
              result.jobsEnqueued += enqueued;
              // Mark message as seen
              await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
            }
          } catch (err: unknown) {
            const errStr = `Failed parsing email UID ${msg.uid}: ${String(err)}`;
            this.logger.warn(errStr);
            result.errors.push(errStr);
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
      this.logger.log(
        `Email sync complete: ${result.totalProcessed} emails scanned, ${result.jobsEnqueued} jobs enqueued`,
      );
    } catch (err: unknown) {
      const errStr = `IMAP connection error: ${String(err)}`;
      this.logger.error(errStr);
      result.errors.push(errStr);
    }

    return result;
  }

  /**
   * Detect sender and parse job alerts from LinkedIn, Bayt, GulfTalent, Indeed, Upwork
   */
  private async parseAndEnqueue(mail: ParsedMail, userId: string): Promise<number> {
    const from = mail.from?.value?.[0]?.address?.toLowerCase() ?? '';
    const subject = mail.subject ?? '';
    const text = mail.text ?? '';
    const html = (mail.html as string) ?? '';

    // Determine platform
    let platform = 'GENERIC';
    if (from.includes('upwork') || subject.toLowerCase().includes('upwork')) {
      platform = 'UPWORK';
    } else if (from.includes('linkedin') || subject.includes('LinkedIn')) {
      platform = 'LINKEDIN';
    } else if (from.includes('bayt') || subject.includes('Bayt')) {
      platform = 'BAYT';
    } else if (from.includes('gulftalent') || subject.includes('GulfTalent')) {
      platform = 'GULFTALENT';
    } else if (from.includes('indeed') || subject.includes('Indeed')) {
      platform = 'INDEED';
    }

    if (platform === 'UPWORK') {
      return this.parseUpworkEmail(mail, userId);
    }

    // Extract links from email HTML or text
    const linkMatches = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)];
    const primaryUrl = linkMatches.length > 0 ? linkMatches[0][1] : undefined;

    // Use subject + content as rawText
    const rawText = [
      `Source: ${platform} Alert Email`,
      `Subject: ${subject}`,
      `Date: ${mail.date?.toISOString() ?? new Date().toISOString()}`,
      `Content:\n${text || html.replace(/<[^>]+>/g, ' ').slice(0, 4000)}`,
    ].join('\n');

    if (rawText.trim().length < 50) {
      this.logger.debug(`Skipping email: content too short (UID)`);
      return 0;
    }

    await this.pipeline.addJob({
      userId,
      rawText,
      url: primaryUrl,
      type: 'JOB',
      sourceType: 'EMAIL',
    });

    return 1;
  }

  /**
   * Dedicated parser for Upwork freelance alert emails.
   * Parses job title, hourly / fixed price budget, client payment verification,
   * proposals competition tier, and skills.
   */
  async parseUpworkEmail(mail: ParsedMail, userId: string): Promise<number> {
    const subject = mail.subject ?? '';
    const text = mail.text ?? '';
    const html = (mail.html as string) ?? '';
    const content = text || html.replace(/<[^>]+>/g, ' ');

    // Match Upwork job URLs (e.g. https://www.upwork.com/jobs/~01abc123456789)
    const urlMatches = [
      ...content.matchAll(/https?:\/\/(?:www\.)?upwork\.com\/jobs\/([~a-zA-Z0-9_]+)/gi),
      ...html.matchAll(/href=["'](https?:\/\/(?:www\.)?upwork\.com\/jobs\/[~a-zA-Z0-9_]+)["']/gi),
    ];
    const upworkUrls = Array.from(new Set(urlMatches.map((m) => m[1] ? (m[1].startsWith('http') ? m[1] : `https://www.upwork.com/jobs/${m[1]}`) : m[0])));

    // Extract budget / rates
    const hourlyMatch = content.match(/Hourly[:\s]+(\$[0-9.]+\s*-\s*\$[0-9.]+|\$[0-9.]+)(?:\s*\/hr)?/i);
    const fixedMatch = content.match(/(?:Fixed[- ]?price|Est\. Budget)[:\s]+(\$[0-9,]+)/i);
    const budgetStr = hourlyMatch ? `Hourly: ${hourlyMatch[1]}/hr` : fixedMatch ? `Fixed-price: ${fixedMatch[1]}` : 'Budget: Unspecified';

    // Client verification & history
    const paymentVerified = /payment\s+verified/i.test(content);
    const ratingMatch = content.match(/Rating[:\s]+([0-5](?:\.\d+)?)/i) || content.match(/([0-5](?:\.\d+)?)\s+of\s+5\s+stars/i);
    const rating = ratingMatch ? ratingMatch[1] : undefined;
    const spentMatch = content.match(/(\$[0-9kKmM+]+)\s+spent/i);
    const spent = spentMatch ? spentMatch[1] : undefined;
    const countryMatch = content.match(/(?:Location|Client Location|Country)[:\s]+([A-Za-z\s]+)/i);
    const clientCountry = countryMatch ? countryMatch[1].trim() : undefined;

    // Competition / Proposals tier
    const proposalsMatch = content.match(/Proposals[:\s]+(Less than 5|5 to 10|10 to 15|15 to 20|20 to 50|\d+\+?)/i);
    const proposalsTier = proposalsMatch ? proposalsMatch[1] : 'Unknown';

    // Skills
    const skillsMatch = content.match(/Skills?[:\s]+([^\n\r]+)/i);
    const skillsStr = skillsMatch ? skillsMatch[1].trim() : '';

    // Title from subject (cleaning prefixes like 'Job Alert:', 'New job:', etc.)
    const cleanTitle = subject
      .replace(/^(?:Fwd:\s*|Re:\s*)?(?:\[Upwork\]\s*)?(?:Job Alert:\s*|New job:\s*|Upwork:\s*)?/i, '')
      .trim() || 'Freelance Opportunity';

    // Format structured freelance rawText
    const rawText = [
      `Source: UPWORK Freelance Alert`,
      `Job Title: ${cleanTitle}`,
      `Budget: ${budgetStr}`,
      `Client Trust: Payment verified: ${paymentVerified ? 'Yes' : 'No'}${rating ? `, Rating: ${rating}/5` : ''}${spent ? `, Total Spent: ${spent}` : ''}${clientCountry ? `, Country: ${clientCountry}` : ''}`,
      `Competition: ${proposalsTier} proposals`,
      skillsStr ? `Skills: ${skillsStr}` : '',
      `URL: ${upworkUrls[0] || 'https://www.upwork.com'}`,
      `Date: ${mail.date?.toISOString() ?? new Date().toISOString()}`,
      `\nProject Description:\n${content.slice(0, 4000)}`,
    ].filter(Boolean).join('\n');

    await this.pipeline.addJob({
      userId,
      rawText,
      url: upworkUrls[0],
      type: 'FREELANCE',
      sourceType: 'EMAIL',
    });

    this.logger.log(`Enqueued Upwork freelance opportunity: "${cleanTitle}" (${budgetStr}, Proposals: ${proposalsTier})`);
    return 1;
  }
}
