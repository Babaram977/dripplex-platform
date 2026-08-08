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
  /** Optional declared byte size; rejected server-side when over the cap. */
  contentLength?: number;
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
  /** Headers the client should send on the PUT. */
  requiredHeaders: { 'Content-Type': string };
}
