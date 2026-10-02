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
    if (from.includes('linkedin') || subject.includes('LinkedIn')) {
      platform = 'LINKEDIN';
    } else if (from.includes('bayt') || subject.includes('Bayt')) {
      platform = 'BAYT';
    } else if (from.includes('gulftalent') || subject.includes('GulfTalent')) {
      platform = 'GULFTALENT';
    } else if (from.includes('indeed') || subject.includes('Indeed')) {
      platform = 'INDEED';
    } else if (from.includes('upwork') || subject.includes('Upwork')) {
      platform = 'UPWORK';
    }

    const isFreelance = platform === 'UPWORK';

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
      type: isFreelance ? 'FREELANCE' : 'JOB',
      sourceType: 'EMAIL',
    });

    return 1;
  }
}
