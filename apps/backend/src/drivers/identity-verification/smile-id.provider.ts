import { createHmac } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { IdentityVerificationProvider as IdentityVerificationProviderEnum } from '@prisma/client';

import { ValidationDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';

import type {
  EnrollInput,
  IdentityVerificationProvider,
  VerificationResult,
  VerifyInput,
} from './identity-verification-provider.adapter';

/**
 * Real Smile ID adapter — real signing helper, real request shape, same
 * "config-checked, throws a clear error until real credentials exist"
 * pattern as `PaystackProvider`. Signature scheme confirmed against Smile
 * ID's public docs: HMAC-SHA256(key=api_key, message=timestamp + partner_id
 * + "sid_request"), base64-encoded, sent with partner_id/timestamp on every
 * request to `submit_job`. No sandbox credentials exist in this
 * environment — see docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md.
 */
@Injectable()
export class SmileIdProvider implements IdentityVerificationProvider {
  public readonly provider = IdentityVerificationProviderEnum.SMILE_ID;
  private readonly logger = new Logger(SmileIdProvider.name);

  constructor(private readonly config: AppConfigService) {}

  public enroll(input: EnrollInput): Promise<VerificationResult> {
    return this.submitJob('smart_selfie_enrollment', {
      partner_params: {
        user_id: input.driverId,
        job_id: `enroll-${input.driverId}-${String(Date.now())}`,
      },
      image_links: {
        selfie_image: input.selfieImageBase64,
        ...(input.idDocumentImageBase64 !== undefined
          ? { id_card_image: input.idDocumentImageBase64 }
          : {}),
      },
      ...(input.idNumber !== undefined ? { id_number: input.idNumber } : {}),
    });
  }

  public verify(input: VerifyInput): Promise<VerificationResult> {
    return this.submitJob('smart_selfie_authentication', {
      partner_params: {
        user_id: input.driverId,
        job_id: `verify-${input.driverId}-${String(Date.now())}`,
      },
      image_links: { selfie_image: input.selfieImageBase64 },
    });
  }

  private signRequest(timestamp: string): string {
    return createHmac('sha256', this.config.smileIdApiKey)
      .update(`${timestamp}${this.config.smileIdPartnerId}sid_request`)
      .digest('base64');
  }

  private async submitJob(
    jobType: string,
    payload: Record<string, unknown>,
  ): Promise<VerificationResult> {
    if (!this.config.smileIdConfigured) {
      throw new ValidationDomainException('Smile ID is not configured');
    }

    const timestamp = new Date().toISOString();
    const body = {
      partner_id: this.config.smileIdPartnerId,
      timestamp,
      signature: this.signRequest(timestamp),
      job_type: jobType,
      ...payload,
    };

    const baseUrl = this.config.smileIdBaseUrl.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/submit_job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `Smile ID request failed (${String(response.status)}): ${text.slice(0, 200)}`,
      );
      return {
        status: 'ERROR',
        failureReason: `Smile ID request failed (${String(response.status)})`,
      };
    }

    const result = (await response.json()) as {
      ResultCode?: string;
      ResultText?: string;
      ConfidenceValue?: string | number;
      SmileJobID?: string;
    };

    // Exact ResultCode taxonomy needs finalizing against real Smile ID docs
    // + a sandbox account once credentials are provisioned — this maps the
    // documented success-code convention ("1020"-prefixed = passed) without
    // fabricating the rest of the table.
    const passed = result.ResultCode?.startsWith('1020') === true;
    return {
      status: passed ? 'PASSED' : 'FAILED',
      ...(result.ConfidenceValue !== undefined
        ? { confidenceScore: Number(result.ConfidenceValue) }
        : {}),
      ...(result.SmileJobID !== undefined ? { providerReference: result.SmileJobID } : {}),
      ...(!passed && result.ResultText !== undefined ? { failureReason: result.ResultText } : {}),
      raw: result,
    };
  }
}
