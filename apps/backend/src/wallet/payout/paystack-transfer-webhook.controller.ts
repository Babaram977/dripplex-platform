import { createHmac, timingSafeEqual } from 'node:crypto';

import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';

import { Public } from '../../common/decorators/permissions.decorator';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';

import { PayoutFulfillmentService } from './payout-fulfillment.service';

import type { Request } from 'express';

@Controller('webhooks')
export class PaystackTransferWebhookController {
  constructor(
    private readonly config: AppConfigService,
    private readonly fulfillment: PayoutFulfillmentService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('paystack-transfer')
  @HttpCode(HttpStatus.OK)
  public async handle(
    @Req() request: Request,
    @Headers('x-paystack-signature') signature: string | undefined,
    @Body() payload: unknown,
  ): Promise<{ success: boolean }> {
    if (!signature || !this.verify(this.rawBody(request, payload), signature)) {
      return { success: false };
    }

    if (!this.isTransferEvent(payload)) return { success: true };
    const reference = payload.data.reference;
    const terminal = payload.event === 'transfer.success' ? 'SUCCESS' : 'FAILED';
    const providerReference = payload.data.transfer_code ?? (payload.data.id !== undefined ? String(payload.data.id) : null);
    const reason = payload.data.failures ? String(payload.data.failures) : payload.event;

    // Shared customer/rider/driver wallet payout reconciliation.
    await this.fulfillment.processProviderResult(reference, terminal, providerReference, reason);
    // Fleet settlements use the same provider and the same webhook, but have
    // a separate payable ledger because they are not wallet withdrawals.
    await this.processFleetTransfer(reference, terminal, providerReference, reason);
    return { success: true };
  }

  private async processFleetTransfer(reference: string, status: 'SUCCESS' | 'FAILED', providerReference: string | null, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; request_id: string | null; amount: number; transfer_status: string; receivable_id: string | null }>>`
        SELECT t.id, t.settlement_request_id AS request_id, t.amount::float8 AS amount,
               t.status::text AS transfer_status, r.receivable_id
        FROM fleet_settlement_transfers t
        LEFT JOIN fleet_settlement_requests r ON r.id = t.settlement_request_id
        WHERE t.id = ${reference}::uuid
        LIMIT 1
        FOR UPDATE`;
      const transfer = rows[0];
      if (!transfer || transfer.transfer_status !== 'PENDING') return;

      if (status === 'SUCCESS') {
        await tx.$executeRaw`
          UPDATE fleet_settlement_transfers
          SET status = 'SUCCESS', provider_reference = ${providerReference}, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${reference}::uuid AND status = 'PENDING'`;
        if (transfer.request_id) {
          await tx.$executeRaw`
            UPDATE fleet_settlement_requests SET status = 'PAID', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${transfer.request_id}::uuid AND status = 'PROCESSING'`;
        }
        return;
      }

      await tx.$executeRaw`
        UPDATE fleet_settlement_transfers
        SET status = CASE WHEN ${reason} = 'transfer.reversed' THEN 'REVERSED' ELSE 'FAILED' END,
            provider_reference = ${providerReference}, failure_reason = ${reason.slice(0, 500)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${reference}::uuid AND status = 'PENDING'`;
      if (transfer.request_id) {
        await tx.$executeRaw`
          UPDATE fleet_settlement_requests SET status = 'APPROVED', transfer_id = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${transfer.request_id}::uuid AND status = 'PROCESSING'`;
        if (transfer.receivable_id) {
          await tx.$executeRaw`
            UPDATE fleet_settlement_receivables SET remaining_amount = remaining_amount + ${transfer.amount}, status = 'APPROVED', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${transfer.receivable_id}::uuid`;
        }
      }
    });
  }

  private isTransferEvent(value: unknown): value is {
    event: 'transfer.success' | 'transfer.failed' | 'transfer.reversed';
    data: { reference: string; transfer_code?: string | null; id?: number | string; failures?: unknown };
  } {
    if (typeof value !== 'object' || value === null) return false;
    const event = (value as { event?: unknown }).event;
    const data = (value as { data?: unknown }).data;
    return (
      (event === 'transfer.success' || event === 'transfer.failed' || event === 'transfer.reversed') &&
      typeof data === 'object' && data !== null &&
      typeof (data as { reference?: unknown }).reference === 'string'
    );
  }

  private verify(rawBody: string | Buffer, signature: string): boolean {
    const secret = this.config.paystackSecretKey;
    if (!secret) return false;
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = createHmac('sha512', secret).update(body).digest('hex');
    try {
      const a = Buffer.from(expected, 'utf8');
      const b = Buffer.from(signature, 'utf8');
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private rawBody(request: Request, payload: unknown): string | Buffer {
    const withRaw = request as Request & { rawBody?: Buffer | string };
    return withRaw.rawBody ?? JSON.stringify(payload ?? {});
  }
}
