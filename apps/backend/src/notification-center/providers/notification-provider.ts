import type { Notification } from '@prisma/client';

/**
 * DPX-CORE-001: one interface per external delivery channel (PUSH/EMAIL/SMS).
 * Business logic (NotificationCenterService, every domain that calls
 * `send()`/`broadcast()`) only ever depends on this shape, never on a
 * specific provider — swapping the bound implementation later (real FCM,
 * real Termii, etc.) or adding a new channel (WhatsApp, Telegram, Web
 * Push) needs zero call-site changes.
 *
 * A provider must never throw for "no credentials configured" — that's an
 * expected, permanent state until Phase D (real provider credentials),
 * not a transient failure worth retrying. Return `configured: false`
 * instead; only throw for genuine transient errors from a real provider
 * (network failure, rate limit, etc.) once one exists.
 */
export interface NotificationProviderResult {
  configured: boolean;
  provider: string;
  providerMessageId?: string;
}

export interface NotificationProvider {
  send(notification: Notification): Promise<NotificationProviderResult>;
}

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
