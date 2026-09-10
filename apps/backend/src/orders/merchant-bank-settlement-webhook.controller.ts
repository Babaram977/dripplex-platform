import { createHmac, timingSafeEqual } from 'node:crypto';

import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';

import { Public } from '../common/decorators/permissions.decorator';
import { AppConfigService } from '../config/app-config.service';

import { MerchantBankSettlementService } from './merchant-bank-settlement.service';

import type { Request } from 'express';

@Controller('webhooks')
export class MerchantBankSettlementWebhookController {
  constructor(
    private readonly config: AppConfigService,
    private readonly settlements: MerchantBankSettlementService,
  ) {}

  @Public()
  @Post('paystack-merchant-settlement')
  @HttpCode(HttpStatus.OK)
  public async handle(
    @Req() request: Request,
    @Headers('x-paystack-signature') signature: string | undefined,
    @Body() payload: unknown,
  ): Promise<{ success: boolean }> {
    if (!signature || !this.verify(this.rawBody(request, payload), signature)) return { success: false };
    if (!this.isTransferEvent(payload)) return { success: true };

    await this.settlements.processProviderResult(
      payload.data.reference,
      payload.event === 'transfer.success' ? 'SUCCESS' : 'FAILED',
      payload.event,
    );
    return { success: true };
  }

  private isTransferEvent(value: unknown): value is { event: 'transfer.success' | 'transfer.failed' | 'transfer.reversed'; data: { reference: string } } {
    if (typeof value !== 'object' || value === null) return false;
    const event = (value as { event?: unknown }).event;
    const data = (value as { data?: unknown }).data;
    return (event === 'transfer.success' || event === 'transfer.failed' || event === 'transfer.reversed') &&
      typeof data === 'object' && data !== null && typeof (data as { reference?: unknown }).reference === 'string';
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
    } catch { return false; }
  }

  private rawBody(request: Request, payload: unknown): string | Buffer {
    const withRaw = request as Request & { rawBody?: Buffer | string };
    return withRaw.rawBody ?? JSON.stringify(payload ?? {});
  }
}
