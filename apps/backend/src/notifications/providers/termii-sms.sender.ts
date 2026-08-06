import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';

export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
}

interface TermiiSendResponse {
  message_id?: string;
  message?: string;
  code?: string;
}

/**
 * Real Termii SMS adapter. Returns { success: false, errorMessage } rather
 * than throwing for both "not configured" and genuine API/network failures
 * — ProductionNotificationService treats SMS delivery as best-effort (the
 * OTP is already persisted in Redis before this is called; a transient
 * carrier failure must not fail registration/login, the user can resend).
 */
@Injectable()
export class TermiiSmsSender {
  private readonly logger = new Logger(TermiiSmsSender.name);

  constructor(private readonly config: AppConfigService) {}

  public async send(phone: string, message: string): Promise<SmsSendResult> {
    if (!this.config.termiiConfigured) {
      return { success: false, errorMessage: 'Termii is not configured' };
    }

    // Termii expects the destination without a leading '+' (e.g. 2348012345678);
    // our DTOs validate phone as E.164-like with an optional leading '+'.
    const to = phone.replace(/^\+/, '');
    const baseUrl = this.config.termiiBaseUrl.replace(/\/$/, '');

    try {
      const response = await fetch(`${baseUrl}/api/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          from: this.config.termiiSenderId,
          sms: message,
          type: 'plain',
          channel: 'generic',
          api_key: this.config.termiiApiKey,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as TermiiSendResponse;

      if (!response.ok || !body.message_id) {
        const errorMessage = body.message ?? `Termii request failed (${String(response.status)})`;
        this.logger.warn(`Termii SMS send failed: ${errorMessage}`);
        return { success: false, errorMessage };
      }

      return { success: true, providerMessageId: body.message_id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Termii error';
      this.logger.warn(`Termii SMS send threw: ${errorMessage}`);
      return { success: false, errorMessage };
    }
  }
}
