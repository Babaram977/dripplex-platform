/**
 * DI token for the object-storage provider. Mirrors the identity-verification /
 * payment adapter pattern: one interface, one real implementation per backend,
 * injected by token so UploadsService never depends on a concrete vendor class.
 */
export const OBJECT_STORAGE_PROVIDER = Symbol('OBJECT_STORAGE_PROVIDER');

/** Short-lived pre-signed PUT URL TTL (seconds). */
export const UPLOAD_URL_TTL_SECONDS = 300;

/** Advisory maximum object size returned to clients (bytes). 10 MiB. */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Content types accepted for upload — images and PDF, covering the real upload
 * surfaces (KYC documents, vehicle photos, profile photos, identity docs). The
 * DTO rejects anything else at the API boundary.
 */
export const UPLOAD_ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type UploadContentType = (typeof UPLOAD_ALLOWED_CONTENT_TYPES)[number];

/**
 * Allowed storage folders (key prefixes). Each maps to an existing upload
 * surface identified in DPX-DRIVER-013 §E; new surfaces must be added here
 * deliberately rather than accepting arbitrary client-supplied prefixes.
 */
export const UPLOAD_FOLDERS = [
  'kyc-documents',
  'vehicle-photos',
  'profile-photos',
  'identity-verification',
] as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/** File extension chosen server-side from the validated content type. */
export const CONTENT_TYPE_EXTENSION: Record<UploadContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
