import { timingSafeEqual } from 'node:crypto';

import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { Public } from '../../common/decorators/permissions.decorator';
import { AppConfigService } from '../../config/app-config.service';

import { PayoutReconciliationService } from './payout-reconciliation.service';

/**
 * Flutterwave's transfer webhook — the second rail's reconciliation.
 *
 * What it does with an outcome is not written here: both rails report the same
 * three things about the same transfers, so both delegate to
 * `PayoutReconciliationService`. The only thing that differs between the two
 * controllers is how the caller is authenticated, and that is the only thing
 * that should.
 *
 * Flutterwave authenticates with a shared secret echoed in a `verif-hash`
 * header rather than an HMAC of the body. That is weaker than Paystack's
 * signature — it proves the sender knows the secret but says nothing about the
 * body — so the reference is still the only thing trusted out of the payload,
 * and every state change below is keyed on a transfer we already created.
 */
@Controller('webhooks')
export class FlutterwaveTransferWebhookController {
  constructor(
    private readonly config: AppConfigService,
    private readonly reconciliation: PayoutReconciliationService,
  ) {}

  @Public()
  @Post('flutterwave-transfer')
  @HttpCode(HttpStatus.OK)
  public async handle(
    @Headers('verif-hash') hash: string | undefined,
    @Body() payload: unknown,
  ): Promise<{ success: boolean }> {
    if (hash === undefined || !this.verify(hash)) {
      return { success: false };
    }

    if (!this.isTransferEvent(payload)) {
      return { success: true };
    }

    const status = this.terminalStatus(payload.data.status);
    if (status === null) {
      // Still in flight. Nothing to reconcile yet, and marking it either way
      // would be a guess about money.
      return { success: true };
    }

    const reference = payload.data.reference;
    const providerReference = payload.data.id === undefined ? null : String(payload.data.id);
    const reason =
      typeof payload.data.complete_message === 'string' && payload.data.complete_message !== ''
        ? payload.data.complete_message
        : (payload.event ?? 'transfer');

    await this.reconciliation.apply(reference, status, providerReference, reason);
    return { success: true };
  }

  private terminalStatus(status: string | undefined): 'SUCCESS' | 'FAILED' | null {
    switch (status?.toUpperCase()) {
      case 'SUCCESSFUL':
      case 'SUCCESS':
      case 'COMPLETED':
        return 'SUCCESS';
      case 'FAILED':
      case 'ERROR':
        return 'FAILED';
      default:
        return null;
    }
  }

  private isTransferEvent(value: unknown): value is {
    event?: string;
    data: { reference: string; status?: string; id?: number | string; complete_message?: string };
  } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const data = (value as { data?: unknown }).data;
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof (data as { reference?: unknown }).reference === 'string'
    );
  }

  private verify(hash: string): boolean {
    const secret = this.config.flutterwaveWebhookHash;
    if (secret === '') {
      // No configured secret means nothing can be authenticated, so nothing is
      // accepted. Failing open here would let anyone mark a payout succeeded.
      return false;
    }

    const a = Buffer.from(hash, 'utf8');
    const b = Buffer.from(secret, 'utf8');
    // Length must match before timingSafeEqual, which throws otherwise; the
    // comparison itself stays constant-time.
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
