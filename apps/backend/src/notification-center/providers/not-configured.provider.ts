import { Injectable } from '@nestjs/common';

import type { NotificationProvider, NotificationProviderResult } from './notification-provider';

/**
 * Default binding for every external channel (PUSH/EMAIL/SMS) until a real
 * provider account exists — Phase D per docs/DPX-CORE-001-NOTIFICATION-PLATFORM.md.
 * Honestly reports "not configured" rather than silently pretending success
 * (the previous stub behavior) or throwing (which would burn through
 * NotificationCenterService's retry budget for something retrying can never
 * fix). One shared class, parametrized by provider name, so the three
 * bindings (Firebase/APNs, an email provider, an SMS provider) don't need
 * three near-identical files.
 */
@Injectable()
export class NotConfiguredProvider implements NotificationProvider {
  constructor(private readonly providerName: string) {}

  public send(): Promise<NotificationProviderResult> {
    return Promise.resolve({ configured: false, provider: this.providerName });
  }
}
