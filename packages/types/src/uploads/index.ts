/**
 * DPX-DRIVER-016 — signed direct-to-storage uploads. The client asks the backend
 * to sign an upload, PUTs the bytes straight to object storage at `uploadUrl`,
 * then submits `publicUrl`/`key` back through whatever feature contract needs it
 * (KYC document URL, vehicle photo, profile photo, etc.).
 */
export type UploadContentType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export type UploadFolder =
  'kyc-documents' | 'vehicle-photos' | 'profile-photos' | 'identity-verification';

export interface SignUploadRequest {
  contentType: UploadContentType;
  folder: UploadFolder;
  /**
   * DPX-STORAGE-001 — exact byte length of the file. Required: it is capped and
   * bound into the pre-signed URL's signature, so the upload is rejected by
   * storage if the real length differs.
   */
  contentLength: number;
}

export interface SignUploadResponse {
  /** Pre-signed URL to PUT the file bytes directly to. */
  uploadUrl: string;
  method: 'PUT';
  /** Object key within the bucket. */
  key: string;
  /** Stable URL the object is readable at once uploaded. */
  publicUrl: string;
  /** ISO-8601 expiry of the pre-signed URL. */
  expiresAt: string;
  /** Advisory maximum object size in bytes. */
  maxBytes: number;
  /**
   * Headers the client MUST send on the PUT — both are bound into the signature
   * (DPX-STORAGE-001), so the upload fails if they don't match exactly.
   */
  requiredHeaders: { 'Content-Type': string; 'Content-Length': string };
}
