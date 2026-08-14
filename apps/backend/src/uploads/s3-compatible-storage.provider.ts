import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';

import { createPresignedUrl } from './sigv4.util';
import { isPublicUploadKey } from './uploads.constants';

import type {
  ObjectStorageProvider,
  PresignGetInput,
  PresignGetResult,
  PresignPutInput,
  PresignPutResult,
} from './object-storage-provider.adapter';

/**
 * S3-compatible object-storage provider using path-style addressing and SigV4
 * pre-signed PUT URLs (see sigv4.util.ts). Works unchanged against Cloudflare R2
 * and AWS S3 — the only difference is the configured endpoint/region. Stays a
 * safe no-op until credentials are configured (same pattern as Smile ID /
 * payment providers): it throws a clear error rather than crashing at boot, so
 * the app runs with uploads disabled until object storage is wired up.
 */
@Injectable()
export class S3CompatibleStorageProvider implements ObjectStorageProvider {
  private static readonly SERVICE = 's3';

  constructor(private readonly config: AppConfigService) {}

  public createPresignedPutUrl(input: PresignPutInput): Promise<PresignPutResult> {
    if (!this.config.objectStorageConfigured) {
      throw new Error(
        'Object storage is not configured (set OBJECT_STORAGE_ENDPOINT / BUCKET / ' +
          'ACCESS_KEY_ID / SECRET_ACCESS_KEY).',
      );
    }

    const endpoint = new URL(this.config.objectStorageEndpoint);

    // Public, shopper-facing assets (product images, avatars) go to the separate
    // PUBLIC-read bucket and are served from the public base URL. Sensitive
    // objects (KYC, identity, vehicle, delivery proofs) stay in the private
    // bucket. Public routing only activates when BOTH the public bucket and base
    // URL are configured — otherwise everything behaves exactly as before.
    const publicBase = this.config.objectStoragePublicBaseUrl.replace(/\/$/, '');
    const publicBucket = this.config.objectStoragePublicBucket;
    const routePublic = isPublicUploadKey(input.key) && publicBucket !== '' && publicBase !== '';

    const bucket = routePublic ? publicBucket : this.config.objectStorageBucket;
    const path = `/${bucket}/${input.key}`;

    const signed = createPresignedUrl({
      method: 'PUT',
      host: endpoint.host,
      path,
      protocol: endpoint.protocol.replace(':', ''),
      region: this.config.objectStorageRegion,
      service: S3CompatibleStorageProvider.SERVICE,
      accessKeyId: this.config.objectStorageAccessKeyId,
      secretAccessKey: this.config.objectStorageSecretAccessKey,
      expiresInSeconds: input.expiresInSeconds,
      now: new Date(),
      // Bind the declared type and exact byte length into the signature so the
      // pre-signed URL rejects an upload of a different content-type or size.
      signedHeaders: {
        'content-type': input.contentType,
        'content-length': String(input.contentLength),
      },
    });

    // Public objects → stable public URL. Private objects keep the (non-public)
    // canonical endpoint/bucket path; they are only ever read via a signed GET.
    const publicUrl = routePublic
      ? `${publicBase}/${input.key}`
      : `${endpoint.origin}/${bucket}/${input.key}`;

    return Promise.resolve({
      uploadUrl: signed.url,
      key: input.key,
      publicUrl,
      expiresAt: signed.expiresAt,
    });
  }

  public createPresignedGetUrl(input: PresignGetInput): Promise<PresignGetResult> {
    if (!this.config.objectStorageConfigured) {
      throw new Error(
        'Object storage is not configured (set OBJECT_STORAGE_ENDPOINT / BUCKET / ' +
          'ACCESS_KEY_ID / SECRET_ACCESS_KEY).',
      );
    }

    const endpoint = new URL(this.config.objectStorageEndpoint);
    const bucket = this.config.objectStorageBucket;
    const path = `/${bucket}/${input.key}`;

    // GET signs only `host` (no content headers), same SigV4 machinery as PUT.
    // Sensitive objects live in a private bucket, so this signed URL is the only
    // way an authorized reader can fetch them (DPX-STORAGE-001, decision F).
    const signed = createPresignedUrl({
      method: 'GET',
      host: endpoint.host,
      path,
      protocol: endpoint.protocol.replace(':', ''),
      region: this.config.objectStorageRegion,
      service: S3CompatibleStorageProvider.SERVICE,
      accessKeyId: this.config.objectStorageAccessKeyId,
      secretAccessKey: this.config.objectStorageSecretAccessKey,
      expiresInSeconds: input.expiresInSeconds,
      now: new Date(),
    });

    return Promise.resolve({ url: signed.url, expiresAt: signed.expiresAt });
  }
}
