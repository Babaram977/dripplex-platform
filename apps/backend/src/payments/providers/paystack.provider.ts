import { createHmac, timingSafeEqual } from 'node:crypto';

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

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    id: number | string;
    paid_at?: string | null;
    gateway_response?: string;
  };
}

@Injectable()
export class PaystackProvider implements PaymentProviderAdapter {
  public readonly provider = PaymentProvider.PAYSTACK;
  private readonly logger = new Logger(PaystackProvider.name);

  constructor(private readonly config: AppConfigService) {}

  public async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const secret = this.config.paystackSecretKey;
    if (!secret) {
      throw new ValidationDomainException('Paystack is not configured');
    }

    // Paystack expects amount in kobo (smallest currency unit)
    const amountKobo = Math.round(input.amount * 100);
    const response = await this.request<PaystackInitResponse>('/transaction/initialize', {
      method: 'POST',
      body: {
        email: input.email,
        amount: amountKobo,
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: {
          orderId: input.orderId,
          orderNumber: input.orderNumber,
          ...(input.metadata ?? {}),
        },
      },
    });

    if (!response.status || !response.data?.authorization_url) {
      throw new ValidationDomainException(response.message || 'Paystack initialization failed');
    }

    return {
      provider: this.provider,
      reference: response.data.reference || input.reference,
      authorizationUrl: response.data.authorization_url,
      accessCode: response.data.access_code,
      raw: response,
    };
  }

  public async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const secret = this.config.paystackSecretKey;
    if (!secret) {
      throw new ValidationDomainException('Paystack is not configured');
    }

    const response = await this.request<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(input.reference)}`,
      { method: 'GET' },
    );

    const data = response.data;
    const success = response.status && data?.status === 'success';

    return {
      success,
      reference: data?.reference ?? input.reference,
      providerTransactionId: data?.id !== undefined ? String(data.id) : null,
      ...(data?.amount !== undefined ? { amount: data.amount / 100 } : {}),
      ...(data?.currency !== undefined ? { currency: data.currency } : {}),
      paidAt: data?.paid_at ? new Date(data.paid_at) : null,
      gatewayResponse: response,
      ...(data?.status !== undefined ? { status: data.status } : {}),
    };
  }

  public handleWebhook(input: WebhookHandleInput): Promise<WebhookHandleResult> {
    const secret = this.config.paystackSecretKey;
    if (!secret) {
      return Promise.resolve({ accepted: false, reason: 'Paystack is not configured' });
    }

    const signatureHeader = input.headers['x-paystack-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature || !this.verifySignature(input.rawBody, signature, secret)) {
      return Promise.resolve({ accepted: false, reason: 'Invalid Paystack signature' });
    }

    const payload = input.payload as {
      event?: string;
      data?: {
        reference?: string;
        id?: number | string;
        status?: string;
        amount?: number;
        currency?: string;
        paid_at?: string | null;
      };
    };

    const reference = payload.data?.reference;
    if (!reference) {
      return Promise.resolve({ accepted: false, reason: 'Missing payment reference' });
    }

    const success = payload.event === 'charge.success' || payload.data?.status === 'success';

    this.logger.log(`Paystack webhook accepted event=${payload.event ?? 'unknown'}`);

    return Promise.resolve({
      accepted: true,
      ...(payload.event !== undefined ? { event: payload.event } : {}),
      reference,
      success,
      providerTransactionId: payload.data?.id !== undefined ? String(payload.data.id) : null,
      ...(payload.data?.amount !== undefined ? { amount: payload.data.amount / 100 } : {}),
      ...(payload.data?.currency !== undefined ? { currency: payload.data.currency } : {}),
      paidAt: payload.data?.paid_at ? new Date(payload.data.paid_at) : null,
      gatewayResponse: payload,
    });
  }

  private verifySignature(rawBody: string | Buffer, signature: string, secret: string): boolean {
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const hash = createHmac('sha512', secret).update(body).digest('hex');
    try {
      const a = Buffer.from(hash);
      const b = Buffer.from(signature);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private async request<T>(
    path: string,
    options: { method: 'GET' | 'POST'; body?: Record<string, unknown> },
  ): Promise<T> {
    const baseUrl = this.config.paystackBaseUrl.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${this.config.paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ValidationDomainException(
        `Paystack request failed (${String(response.status)}): ${text.slice(0, 200)}`,
      );
    }

    return (await response.json()) as T;
  }
}
