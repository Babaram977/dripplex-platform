import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';

export interface EmailSendResult {
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
}

interface ResendSendResponse {
  id?: string;
  message?: string;
}

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Real Resend email adapter. Same non-throwing, best-effort contract as
 * TermiiSmsSender — see that file's header comment.
 */
@Injectable()
export class ResendEmailSender {
  private readonly logger = new Logger(ResendEmailSender.name);

  constructor(private readonly config: AppConfigService) {}

  public async send(to: string, subject: string, html: string): Promise<EmailSendResult> {
    if (!this.config.resendConfigured) {
      return { success: false, errorMessage: 'Resend is not configured' };
    }

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.resendFromEmail,
          to: [to],
          subject,
          html,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as ResendSendResponse;

      if (!response.ok || !body.id) {
        const errorMessage = body.message ?? `Resend request failed (${String(response.status)})`;
        this.logger.warn(`Resend email send failed: ${errorMessage}`);
        return { success: false, errorMessage };
      }

      return { success: true, providerMessageId: body.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Resend error';
      this.logger.warn(`Resend email send threw: ${errorMessage}`);
      return { success: false, errorMessage };
    }
  }
}
