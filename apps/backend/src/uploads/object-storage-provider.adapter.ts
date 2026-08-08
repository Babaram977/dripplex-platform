/**
 * Vendor-neutral object-storage abstraction. Deliberately mirrors
 * `IdentityVerificationProvider` / `PaymentProviderAdapter`: one interface, one
 * real class per backend, injected via the `OBJECT_STORAGE_PROVIDER` DI token so
 * `UploadsService` never depends on a concrete vendor. Swapping Cloudflare R2
 * for AWS S3 (or an SDK-based implementation) means writing one new class and
 * rebinding the token — nothing else in the uploads module changes.
 */
export interface PresignPutInput {
  /** Full object key including folder prefix, e.g. `kyc-documents/<user>/<uuid>.pdf`. */
  key: string;
  contentType: string;
  /**
   * Exact byte length the upload is authorized for. Bound into the signature
   * (DPX-STORAGE-001), so the client must upload exactly this many bytes — the
   * storage-side enforcement of the size cap, not a client-trusted field.
   */
  contentLength: number;
  expiresInSeconds: number;
}

export interface PresignPutResult {
  /** Pre-signed PUT URL the client uploads the bytes directly to. */
  uploadUrl: string;
  key: string;
  /** Stable URL the object is readable at once uploaded. */
  publicUrl: string;
  /** ISO-8601 expiry of the pre-signed URL. */
  expiresAt: string;
}

export interface ObjectStorageProvider {
  createPresignedPutUrl(input: PresignPutInput): Promise<PresignPutResult>;
}
