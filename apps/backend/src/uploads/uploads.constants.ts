/**
 * DI token for the object-storage provider. Mirrors the identity-verification /
 * payment adapter pattern: one interface, one real implementation per backend,
 * injected by token so UploadsService never depends on a concrete vendor class.
 */
export const OBJECT_STORAGE_PROVIDER = Symbol('OBJECT_STORAGE_PROVIDER');

/** Short-lived pre-signed PUT URL TTL (seconds). */
export const UPLOAD_URL_TTL_SECONDS = 300;

/**
 * Short-lived pre-signed GET URL TTL (seconds) for retrieving private objects
 * (DPX-STORAGE-001, decision F). KYC and identity-verification objects are not
 * public-read; authorized readers receive a signed GET URL that expires after
 * this window, so a leaked URL is useless once it lapses.
 */
export const UPLOAD_SIGNED_GET_TTL_SECONDS = 300;

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
  'product-images',
  'delivery-proofs',
  'payment-proofs',
] as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/**
 * DPX-STORAGE-001 (Phase 4, decision G) — least-privilege folder access. A
 * folder may only be signed by a caller holding at least one of the listed
 * permissions; an empty list means any authenticated user. This stops, e.g., a
 * customer minting a `vehicle-photos` or `identity-verification` upload simply
 * by naming the folder. Codes mirror the driver/merchant/kyc permission
 * catalogs (stable contract strings; duplicated here to keep the uploads module
 * decoupled from those feature modules).
 */
export const UPLOAD_FOLDER_PERMISSIONS: Record<UploadFolder, readonly string[]> = {
  // Customer, merchant, and driver KYC flows all legitimately write here.
  'kyc-documents': [
    'customer:kyc:manage',
    'merchant:kyc:manage',
    'driver:kyc:manage',
    'rider:kyc:manage',
  ],
  // Only drivers upload their own vehicle photos.
  'vehicle-photos': ['driver:vehicle:manage'],
  // Every authenticated user has a profile/avatar — no extra permission.
  'profile-photos': [],
  // Driver identity documents only.
  'identity-verification': ['driver:identity-verification:manage'],
  // Merchants upload photos for their own catalogue products.
  'product-images': ['merchant:products:manage'],
  // Riders upload proof-of-delivery photos for their own jobs.
  'delivery-proofs': ['rider:delivery:manage'],
  // Customers upload the bank receipt for their own MERCHANT_DIRECT order.
  'payment-proofs': ['customer:orders'],
};

/**
 * Folders whose objects are PUBLIC-read (served from the public bucket + public
 * base URL) rather than private (signed GET). Only non-sensitive, shopper-facing
 * assets belong here. Everything NOT listed stays in the private bucket:
 * kyc-documents, identity-verification, vehicle-photos, delivery-proofs and
 * payment-proofs must never be public — a bank receipt carries account details
 * and is financial evidence. Public routing additionally requires OBJECT_STORAGE_PUBLIC_BUCKET
 * + OBJECT_STORAGE_PUBLIC_BASE_URL to be configured (else these fall back to
 * private, unchanged behaviour).
 */
export const PUBLIC_UPLOAD_FOLDERS: ReadonlySet<UploadFolder> = new Set<UploadFolder>([
  'product-images',
  'profile-photos',
]);

export function isPublicUploadKey(key: string): boolean {
  const folder = key.split('/')[0] as UploadFolder;
  return PUBLIC_UPLOAD_FOLDERS.has(folder);
}

/** File extension chosen server-side from the validated content type. */
export const CONTENT_TYPE_EXTENSION: Record<UploadContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
