import type { IdentityVerificationProvider as IdentityVerificationProviderEnum } from '@prisma/client';

/**
 * Driver-001 (docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md). Deliberately
 * mirrors `PayoutProvider`/`PaymentProviderAdapter`'s shape — one interface,
 * real class per vendor, injected by a DI token — so
 * `DriverIdentityVerificationService` never depends on `SmileIdProvider`
 * directly. Adding Onfido or AWS Rekognition later means writing one new
 * class against this interface and swapping the DI binding; nothing else in
 * the Driver module changes.
 */
export interface EnrollInput {
  driverId: string;
  selfieImageBase64: string;
  idDocumentImageBase64?: string;
  idNumber?: string;
}

export interface VerifyInput {
  driverId: string;
  selfieImageBase64: string;
}

export interface VerificationResult {
  status: 'PASSED' | 'FAILED' | 'ERROR';
  confidenceScore?: number;
  providerReference?: string;
  failureReason?: string;
  raw?: unknown;
}

export interface IdentityVerificationProvider {
  readonly provider: IdentityVerificationProviderEnum;
  enroll(input: EnrollInput): Promise<VerificationResult>;
  verify(input: VerifyInput): Promise<VerificationResult>;
}

export const IDENTITY_VERIFICATION_PROVIDER = Symbol('IDENTITY_VERIFICATION_PROVIDER');
