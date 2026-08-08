import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';

import { createPresignedUrl } from './sigv4.util';

import type {
  ObjectStorageProvider,
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
    const bucket = this.config.objectStorageBucket;
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
    });

    const publicBase = this.config.objectStoragePublicBaseUrl;
    const publicUrl =
      publicBase !== ''
        ? `${publicBase.replace(/\/$/, '')}/${input.key}`
        : `${endpoint.origin}/${bucket}/${input.key}`;

    return Promise.resolve({
      uploadUrl: signed.url,
      key: input.key,
      publicUrl,
      expiresAt: signed.expiresAt,
    });
  }
}
