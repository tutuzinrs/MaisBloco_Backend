import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const appScheme = process.env.APP_SCHEME ?? 'maisbloco';
    const resetUrl = `${appScheme}://reset-password?token=${token}`;

    if (!this.resend) {
      this.logger.warn(
        `[DEV] RESEND_API_KEY não configurado. Link de redefinição para ${email}: ${resetUrl}`,
      );
      return;
    }

    const from = process.env.RESEND_FROM_EMAIL ?? 'Go Bloco <onboarding@resend.dev>';

    const { error } = await this.resend.emails.send({
      from,
      to: [email],
      subject: 'Redefina sua senha no Go Bloco',
      html: this.renderResetHtml(resetUrl),
    });

    if (error) {
      this.logger.error(
        `Falha ao enviar e-mail de redefinição para ${email}: ${error.message}`,
      );
      return;
    }

    this.logger.log(`E-mail de redefinição enviado para ${email}`);
  }

  private renderResetHtml(resetUrl: string): string {
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; background: #FBF8EF; padding: 32px;">
        <div style="max-width: 440px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; padding: 28px; border: 1px solid #E3E0DF;">
          <h1 style="margin: 0 0 12px; font-size: 22px; color: #10152F;">Redefinição de senha</h1>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 20px; color: #73798E;">
            Recebemos um pedido para redefinir sua senha no Go Bloco.
            O link abaixo é válido por um período limitado e pode ser usado uma única vez.
          </p>
          <a
            href="${resetUrl}"
            style="display: inline-block; background: #DC3984; color: #FFFFFF; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 20px; border-radius: 12px;"
          >
            Redefinir minha senha
          </a>
          <p style="margin: 24px 0 0; font-size: 12px; line-height: 18px; color: #9BA1AF;">
            Se você não solicitou essa alteração, ignore este e-mail. Nenhuma
            mudança será feita na sua conta.
          </p>
        </div>
      </div>
    `;
  }
}