import { timingSafeEqual } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

import { ValidationDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';

import type {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProviderAdapter,
  VerifyPaymentInput,
  VerifyPaymentResult,
  WebhookHandleInput,
  WebhookHandleResult,
} from './payment-provider.adapter';

interface FlutterwaveInitResponse {
  status: string;
  message: string;
  data?: {
    link: string;
    id?: number | string;
  };
}

interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data?: {
    status: string;
    tx_ref: string;
    id: number | string;
    amount: number;
    currency: string;
    charged_amount?: number;
  };
}

@Injectable()
export class FlutterwaveProvider implements PaymentProviderAdapter {
  public readonly provider = PaymentProvider.FLUTTERWAVE;
  private readonly logger = new Logger(FlutterwaveProvider.name);

  constructor(private readonly config: AppConfigService) {}

  public async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const secret = this.config.flutterwaveSecretKey;
    if (!secret) {
      throw new ValidationDomainException('Flutterwave is not configured');
    }

    const response = await this.request<FlutterwaveInitResponse>('/v3/payments', {
      method: 'POST',
      body: {
        tx_ref: input.reference,
        amount: input.amount,
        currency: input.currency,
        redirect_url: input.callbackUrl,
        customer: { email: input.email },
        meta: {
          orderId: input.orderId,
          orderNumber: input.orderNumber,
          ...(input.metadata ?? {}),
        },
        customizations: {
          title: 'DrippleX Order Payment',
          description: `Payment for ${input.orderNumber}`,
        },
      },
    });

    if (response.status !== 'success' || !response.data?.link) {
      throw new ValidationDomainException(response.message || 'Flutterwave initialization failed');
    }

    return {
      provider: this.provider,
      reference: input.reference,
      authorizationUrl: response.data.link,
      providerTransactionId: response.data.id !== undefined ? String(response.data.id) : null,
      raw: response,
    };
  }

  public async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const secret = this.config.flutterwaveSecretKey;
    if (!secret) {
      throw new ValidationDomainException('Flutterwave is not configured');
    }

    const response = await this.request<FlutterwaveVerifyResponse>(
      `/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(input.reference)}`,
      { method: 'GET' },
    );

    const data = response.data;
    const success = response.status === 'success' && data?.status === 'successful';

    return {
      success,
      reference: data?.tx_ref ?? input.reference,
      providerTransactionId: data?.id !== undefined ? String(data.id) : null,
      ...(data?.amount !== undefined ? { amount: data.amount } : {}),
      ...(data?.currency !== undefined ? { currency: data.currency } : {}),
      paidAt: success ? new Date() : null,
      gatewayResponse: response,
      ...(data?.status !== undefined ? { status: data.status } : {}),
    };
  }

  public handleWebhook(input: WebhookHandleInput): Promise<WebhookHandleResult> {
    const hash = this.config.flutterwaveWebhookHash || this.config.flutterwaveSecretKey;
    if (!hash) {
      return Promise.resolve({ accepted: false, reason: 'Flutterwave is not configured' });
    }

    const headerValue = input.headers['verif-hash'];
    const provided = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!provided || !this.hashesMatch(provided, hash)) {
      return Promise.resolve({ accepted: false, reason: 'Invalid Flutterwave signature' });
    }

    const payload = input.payload as {
      event?: string;
      data?: {
        tx_ref?: string;
        id?: number | string;
        status?: string;
        amount?: number;
        currency?: string;
      };
    };

    const reference = payload.data?.tx_ref;
    if (!reference) {
      return Promise.resolve({ accepted: false, reason: 'Missing payment reference' });
    }

    const success = payload.event === 'charge.completed' || payload.data?.status === 'successful';

    this.logger.log(`Flutterwave webhook accepted event=${payload.event ?? 'unknown'}`);

    return Promise.resolve({
      accepted: true,
      ...(payload.event !== undefined ? { event: payload.event } : {}),
      reference,
      success,
      providerTransactionId: payload.data?.id !== undefined ? String(payload.data.id) : null,
      ...(payload.data?.amount !== undefined ? { amount: payload.data.amount } : {}),
      ...(payload.data?.currency !== undefined ? { currency: payload.data.currency } : {}),
      paidAt: success ? new Date() : null,
      gatewayResponse: payload,
    });
  }

  private hashesMatch(a: string, b: string): boolean {
    try {
      const left = Buffer.from(a);
      const right = Buffer.from(b);
      return left.length === right.length && timingSafeEqual(left, right);
    } catch {
      return false;
    }
  }

  private async request<T>(
    path: string,
    options: { method: 'GET' | 'POST'; body?: Record<string, unknown> },
  ): Promise<T> {
    const baseUrl = this.config.flutterwaveBaseUrl.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${this.config.flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ValidationDomainException(
        `Flutterwave request failed (${String(response.status)}): ${text.slice(0, 200)}`,
      );
    }

    return (await response.json()) as T;
  }
}
