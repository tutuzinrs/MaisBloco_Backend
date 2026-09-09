import { Injectable, Logger } from '@nestjs/common';

/**
 * Handles transactional e-mails, currently scoped to password recovery.
 *
 * When `SMTP_URL` is not configured (development), the reset link is logged
 * instead of being delivered. Configure SMTP_URL + a transport in production.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const appScheme = process.env.APP_SCHEME ?? 'maisbloco';
    const resetUrl = `${appScheme}://reset-password?token=${token}`;

    if (process.env.SMTP_URL) {
      await this.sendViaSmtp(email, resetUrl);
      return;
    }

    this.logger.warn(
      `[DEV] SMTP_URL não configurado. Link de redefinição para ${email}: ${resetUrl}`,
    );
  }

  private async sendViaSmtp(email: string, resetUrl: string): Promise<void> {
    // Integration point for a transactional provider (Resend, SES, Nodemailer).
    // Keeping it isolated so the auth flow never depends on delivery details.
    this.logger.log(
      `[SMTP] Enviando e-mail de redefinição para ${email}: ${resetUrl}`,
    );
  }
}