import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

import { Public } from '../common/decorators/permissions.decorator';

import { PaymentService } from './payment.service';

import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('webhooks')
export class PaymentWebhooksController {
  constructor(private readonly paymentService: PaymentService) {}

  @Public()
  @Post('paystack')
  @HttpCode(HttpStatus.OK)
  public async paystack(
    @Req() request: Request,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: unknown,
  ): Promise<ApiSuccessResponse<{ accepted: boolean; message: string }>> {
    const data = await this.paymentService.handleWebhook(PaymentProvider.PAYSTACK, {
      rawBody: this.rawBody(request, payload),
      headers,
      payload,
    });
    return { success: true, data };
  }

  @Public()
  @Post('flutterwave')
  @HttpCode(HttpStatus.OK)
  public async flutterwave(
    @Req() request: Request,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: unknown,
  ): Promise<ApiSuccessResponse<{ accepted: boolean; message: string }>> {
    const data = await this.paymentService.handleWebhook(PaymentProvider.FLUTTERWAVE, {
      rawBody: this.rawBody(request, payload),
      headers,
      payload,
    });
    return { success: true, data };
  }

  private rawBody(request: Request, payload: unknown): string | Buffer {
    const withRaw = request as Request & { rawBody?: Buffer | string };
    if (withRaw.rawBody) {
      return withRaw.rawBody;
    }
    return JSON.stringify(payload ?? {});
  }
}
