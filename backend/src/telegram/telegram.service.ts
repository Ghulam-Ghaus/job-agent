import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Markup } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApprovalService } from '../opportunities/approval.service.js';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf | null = null;
  private isEnabled = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly approvalService: ApprovalService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || token.trim() === '' || token.includes('your_') || token.includes('placeholder')) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN is not configured or is a placeholder. Telegram bot service runs in mock/disabled mode.',
      );
      return;
    }

    try {
      this.bot = new Telegraf(token);
      this.registerHandlers();

      // Launch long-polling in background
      this.bot
        .launch({ dropPendingUpdates: true })
        .then(() => {
          this.isEnabled = true;
          this.logger.log('Telegram Bot successfully launched with long polling.');
        })
        .catch((err) => {
          this.logger.error(`Telegram Bot launch failed: ${String(err)}`);
        });
    } catch (err: unknown) {
      this.logger.error(`Failed to initialize Telegram Bot: ${String(err)}`);
    }
  }

  onModuleDestroy() {
    if (this.bot && this.isEnabled) {
      try {
        this.bot.stop('SIGINT');
      } catch (err) {
        this.logger.error(`Error stopping Telegram bot: ${String(err)}`);
      }
    }
  }

  /**
   * Set up bot commands and action handlers
   */
  private registerHandlers() {
    if (!this.bot) return;

    // ── Command: /start [linkToken] ──────────────────────────────────────────
    this.bot.start(async (ctx) => {
      const chatId = String(ctx.chat.id);
      const text = ctx.message.text.trim();
      const payload = text.replace(/^\/start\s*/, '').trim();

      if (payload) {
        // Link attempt with token/identifier
        return this.handleLinkAccount(ctx, chatId, payload);
      }

      await ctx.replyWithMarkdownV2(
        `👋 *Welcome to JobAgent AI Assistant\\!*\n\n` +
          `To link your Telegram account to JobAgent, send:\n` +
          `\`/link <your_account_email_or_user_id>\`\n\n` +
          `*Features:*\n` +
          `• 🎯 Instant Apply Packs for strong matches \\(Score ≥ 80\\)\n` +
          `• ⚡ One\\-tap approval / mark applied buttons\n` +
          `• 📊 20:00 Daily match digest\n\n` +
          `Type \`/help\` for more commands\\.`,
      );
    });

    // ── Command: /link <email|userId> ─────────────────────────────────────────
    this.bot.command('link', async (ctx) => {
      const chatId = String(ctx.chat.id);
      const parts = ctx.message.text.split(/\s+/).slice(1);
      const identifier = parts.join(' ').trim();

      if (!identifier) {
        await ctx.reply('⚠️ Please provide your account email or ID. Example: /link user@example.com');
        return;
      }

      await this.handleLinkAccount(ctx, chatId, identifier);
    });

    // ── Command: /status ──────────────────────────────────────────────────────
    this.bot.command('status', async (ctx) => {
      const chatId = String(ctx.chat.id);
      const profile = await this.prisma.profile.findFirst({
        where: { telegramChatId: chatId },
        include: { user: true },
      });

      if (!profile || !profile.user) {
        await ctx.reply(
          '❌ Your Telegram chat is not linked to any JobAgent user.\nUse /link <email> to connect.',
        );
        return;
      }

      const [pendingCount, totalOpps, totalPacks] = await Promise.all([
        this.prisma.applyPack.count({
          where: { userId: profile.userId, approval: null },
        }),
        this.prisma.opportunity.count({
          where: { userId: profile.userId },
        }),
        this.prisma.applyPack.count({
          where: { userId: profile.userId },
        }),
      ]);

      await ctx.replyWithMarkdownV2(
        `📊 *JobAgent Account Status*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 *User:* \`${this.escapeMarkdown(profile.user.email)}\`\n` +
          `💼 *Total Opportunities:* ${totalOpps}\n` +
          `📦 *Apply Packs Generated:* ${totalPacks}\n` +
          `⏳ *Pending Approvals:* *${pendingCount}*\n\n` +
          `Status: ✅ *Connected & Receiving Alerts*`,
      );
    });

    // ── Command: /help ────────────────────────────────────────────────────────
    this.bot.help(async (ctx) => {
      await ctx.reply(
        '🤖 JobAgent Bot Commands:\n\n' +
          '/status - Check your linked account and pending applications\n' +
          '/link <email> - Link your Telegram account to JobAgent\n' +
          '/help - Show this help menu\n\n' +
          'When high-scoring jobs are found, you will automatically receive alert cards with action buttons here.',
      );
    });

    // ── Action: View Pack ─────────────────────────────────────────────────────
    this.bot.action(/^pack:(.+)$/, async (ctx) => {
      const packId = ctx.match[1];
      try {
        const pack = await this.prisma.applyPack.findUnique({
          where: { id: packId },
          include: {
            opportunity: true,
          },
        });

        if (!pack) {
          await ctx.answerCbQuery('Apply pack not found.');
          return;
        }

        await ctx.answerCbQuery('Previewing Apply Pack');

        const noteSnippet = pack.coverNote
          ? pack.coverNote.slice(0, 500) + (pack.coverNote.length > 500 ? '...' : '')
          : 'No cover note generated.';

        const previewMsg =
          `📄 *Apply Pack Details*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💼 *Role:* ${this.escapeMarkdown(pack.opportunity.title ?? 'Job')}\n` +
          `🏢 *Company:* ${this.escapeMarkdown(pack.opportunity.company ?? 'Unknown')}\n` +
          `🛡️ *Verifier Status:* ${pack.verifierStatus.toUpperCase()}\n\n` +
          `📝 *Cover Note Preview:*\n` +
          `_${this.escapeMarkdown(noteSnippet)}_\n\n` +
          `Tap *Mark Applied* once submitted, or *Reject* to dismiss.`;

        await ctx.replyWithMarkdownV2(previewMsg);
      } catch (err: unknown) {
        this.logger.error(`Failed to handle pack action: ${String(err)}`);
        await ctx.answerCbQuery('Error loading pack preview.');
      }
    });

    // ── Action: Mark Applied ──────────────────────────────────────────────────
    this.bot.action(/^applied:(.+)$/, async (ctx) => {
      const packId = ctx.match[1];
      const chatId = String(ctx.chat?.id);

      try {
        const profile = await this.prisma.profile.findFirst({
          where: { telegramChatId: chatId },
        });

        if (!profile) {
          await ctx.answerCbQuery('Account not linked.');
          return;
        }

        await this.approvalService.decide(
          packId,
          profile.userId,
          'approved',
          'Approved & marked applied via Telegram',
        );

        await ctx.answerCbQuery('Marked as Applied! 🎉');

        // Edit original message buttons to indicate completion
        try {
          await ctx.editMessageReplyMarkup(
            Markup.inlineKeyboard([
              [Markup.button.callback('✅ Successfully Applied', 'noop')],
            ]).reply_markup,
          );
        } catch {
          // Message may be too old or unchanged, non-critical
        }

        await ctx.reply('🎉 Opportunity status updated to **APPLIED** and recorded in audit log.');
      } catch (err: unknown) {
        this.logger.error(`Error marking applied via Telegram: ${String(err)}`);
        await ctx.answerCbQuery('Could not mark applied (maybe already decided).');
      }
    });

    // ── Action: Reject ────────────────────────────────────────────────────────
    this.bot.action(/^reject:(.+)$/, async (ctx) => {
      const packId = ctx.match[1];
      const chatId = String(ctx.chat?.id);

      try {
        const profile = await this.prisma.profile.findFirst({
          where: { telegramChatId: chatId },
        });

        if (!profile) {
          await ctx.answerCbQuery('Account not linked.');
          return;
        }

        await this.approvalService.decide(
          packId,
          profile.userId,
          'rejected',
          'Rejected via Telegram',
        );

        await ctx.answerCbQuery('Application dismissed.');

        try {
          await ctx.editMessageReplyMarkup(
            Markup.inlineKeyboard([
              [Markup.button.callback('❌ Application Rejected', 'noop')],
            ]).reply_markup,
          );
        } catch {
          // non-critical
        }
      } catch (err: unknown) {
        this.logger.error(`Error rejecting application via Telegram: ${String(err)}`);
        await ctx.answerCbQuery('Could not reject (maybe already decided).');
      }
    });

    // ── No-op handler for informational buttons ──────────────────────────────
    this.bot.action('noop', async (ctx) => {
      await ctx.answerCbQuery();
    });
  }

  /**
   * Helper to link a telegram chat to a user account
   */
  private async handleLinkAccount(ctx: any, chatId: string, identifier: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: identifier }, { id: identifier }],
        },
      });

      if (!user) {
        await ctx.reply(
          `❌ No JobAgent account found matching: "${identifier}".\nPlease verify your email address and try again.`,
        );
        return;
      }

      await this.prisma.profile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          telegramChatId: chatId,
        },
        update: {
          telegramChatId: chatId,
        },
      });

      await ctx.reply(
        `✅ Success! Connected this Telegram chat to user: ${user.email}.\nYou will now receive instant Apply Pack notifications!`,
      );
    } catch (err: unknown) {
      this.logger.error(`Error linking user account: ${String(err)}`);
      await ctx.reply('⚠️ An error occurred while linking your account. Please try again.');
    }
  }

  /**
   * Dispatches a rich Telegram alert card for high-matching opportunities
   */
  async sendOpportunityCard(userId: string, opportunityId: string): Promise<boolean> {
    if (!this.bot || !this.isEnabled) {
      this.logger.debug(
        `Telegram bot not active. Skipping Telegram card dispatch for opp ${opportunityId}.`,
      );
      return false;
    }

    try {
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
      });

      if (!profile?.telegramChatId) {
        this.logger.debug(`User ${userId} has not linked a Telegram chat. Skipping notification.`);
        return false;
      }

      const opp = await this.prisma.opportunity.findUnique({
        where: { id: opportunityId },
        include: {
          match: true,
          requirement: true,
          applyPack: true,
        },
      });

      if (!opp || !opp.match) {
        return false;
      }

      const score = opp.match.score;
      const title = opp.title || 'Job Opportunity';
      const company = opp.company || 'Unknown Company';
      const location = [opp.city, opp.country].filter(Boolean).join(', ') || 'Unspecified';
      const packId = opp.applyPack?.id;

      let salaryText = 'Unknown / Unstated';
      if (opp.requirement?.fieldsJson) {
        const fields = opp.requirement.fieldsJson as any;
        if (fields.salaryMax) {
          salaryText = `$${Number(fields.salaryMax).toLocaleString()}/yr`;
        }
      }

      const gaps = ((opp.match.gapsJson as any[]) || []).slice(0, 2);
      const gapsText =
        gaps.length > 0
          ? gaps.map((g) => `• ${g.skill}: ${g.reason}`).join('\n')
          : 'None detected';

      const cardText =
        `🎯 *HIGH MATCH OPPORTUNITY: ${score}/100*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💼 *Role:* ${this.escapeMarkdown(title)}\n` +
        `🏢 *Company:* ${this.escapeMarkdown(company)}\n` +
        `📍 *Location:* ${this.escapeMarkdown(location)}\n` +
        `💰 *Salary:* ${this.escapeMarkdown(salaryText)}\n\n` +
        `⚠️ *Gaps / Notes:*\n${this.escapeMarkdown(gapsText)}\n\n` +
        `📦 *Ready to Apply:* A tailored Apply Pack has been generated.`;

      // Build inline action buttons
      const inlineButtons: any[] = [];
      const row1: any[] = [];

      if (opp.url) {
        row1.push(Markup.button.url('🔗 Open Job Link', opp.url));
      }
      if (packId) {
        row1.push(Markup.button.callback('📄 View Pack', `pack:${packId}`));
      }
      if (row1.length > 0) inlineButtons.push(row1);

      if (packId) {
        inlineButtons.push([
          Markup.button.callback('✅ Mark Applied', `applied:${packId}`),
          Markup.button.callback('❌ Reject', `reject:${packId}`),
        ]);
      }

      await this.bot.telegram.sendMessage(profile.telegramChatId, cardText, {
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard(inlineButtons).reply_markup,
      });

      // Also create an in-app notification
      await this.prisma.notification.create({
        data: {
          userId,
          title: `High Match Alert: ${title} (${score}/100)`,
          body: `Match found at ${company}. Apply pack is ready for review.`,
          link: `/approvals`,
        },
      });

      return true;
    } catch (err: unknown) {
      this.logger.error(`Failed to dispatch Telegram card for opp ${opportunityId}: ${String(err)}`);
      return false;
    }
  }

  /**
   * Daily digest scheduled for 20:00 per PLAN §2.1 & §11.2
   */
  @Cron('0 20 * * *')
  async sendDailyDigest(): Promise<void> {
    if (!this.bot || !this.isEnabled) return;

    this.logger.log('Starting daily 20:00 Telegram digest dispatch...');

    try {
      const linkedProfiles = await this.prisma.profile.findMany({
        where: {
          telegramChatId: { not: null },
        },
        select: { userId: true, telegramChatId: true },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const p of linkedProfiles) {
        if (!p.telegramChatId) continue;

        // Moderate matches (65–79) + pending apply packs from today
        const [pendingPacks, moderateMatches] = await Promise.all([
          this.prisma.applyPack.findMany({
            where: {
              userId: p.userId,
              approval: null,
            },
            include: { opportunity: true },
            take: 5,
          }),
          this.prisma.opportunity.findMany({
            where: {
              userId: p.userId,
              createdAt: { gte: today },
              match: {
                score: { gte: 65, lt: 80 },
              },
            },
            include: { match: true },
            take: 5,
          }),
        ]);

        if (pendingPacks.length === 0 && moderateMatches.length === 0) continue;

        let digest = `🌅 *JobAgent Daily Digest (20:00)*\n━━━━━━━━━━━━━━━━━━━━\n\n`;

        if (pendingPacks.length > 0) {
          digest += `⏳ *Ready Packs Awaiting Review:* ${pendingPacks.length}\n`;
          for (const pack of pendingPacks) {
            digest += `• ${pack.opportunity.title ?? 'Job'} @ ${pack.opportunity.company ?? 'Co'}\n`;
          }
          digest += `\n`;
        }

        if (moderateMatches.length > 0) {
          digest += `📋 *Moderate Matches (Score 65–79):* ${moderateMatches.length}\n`;
          for (const m of moderateMatches) {
            digest += `• [${m.match?.score}/100] ${m.title ?? 'Job'} @ ${m.company ?? 'Co'}\n`;
          }
        }

        await this.bot.telegram.sendMessage(p.telegramChatId, digest, {
          parse_mode: 'Markdown',
        });
      }
    } catch (err: unknown) {
      this.logger.error(`Failed to dispatch daily digest: ${String(err)}`);
    }
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  }
}
