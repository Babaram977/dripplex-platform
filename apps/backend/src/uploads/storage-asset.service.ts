import { Inject, Injectable } from '@nestjs/common';

import { ValidationDomainException } from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';

import { OBJECT_STORAGE_PROVIDER, UPLOAD_SIGNED_GET_TTL_SECONDS } from './uploads.constants';

import type { ObjectStorageProvider } from './object-storage-provider.adapter';
import type { UploadFolder } from './uploads.constants';

/**
 * DPX-STORAGE-001 (Phase 4) — the policy layer around stored asset URLs, shared
 * by the feature modules that persist or read protected assets.
 *
 * - (D) `assertOwned` rejects a persisted protected-asset URL that isn't a
 *   DrippleX storage URL scoped to the owning user's `<folder>/<userId>/` prefix,
 *   closing the "paste any external/cross-user URL" gap. It is a **no-op when
 *   object storage is unconfigured** (local dev), so flows that still submit
 *   hosted URLs keep working; it enforces in any environment with storage wired
 *   up. Credentials/bucket are never invented here — the accepted prefixes are
 *   derived entirely from whatever deployment config is present.
 * - (F) `toSignedGetUrl` converts a stored DrippleX URL for a private object
 *   (KYC / identity documents) into a short-lived signed GET URL for an
 *   authorized reader. It returns the value unchanged when storage is
 *   unconfigured or the URL isn't a recognised storage URL (dev / legacy rows).
 *
 * The accepted base prefixes mirror exactly how `S3CompatibleStorageProvider`
 * builds `publicUrl` (public base URL if set, else `endpoint.origin/bucket`).
 */
@Injectable()
export class StorageAssetService {
  constructor(
    private readonly config: AppConfigService,
    @Inject(OBJECT_STORAGE_PROVIDER)
    private readonly storage: ObjectStorageProvider,
  ) {}

  /** The URL prefixes a DrippleX-stored object may legitimately begin with.
   * Empty when storage is unconfigured, which makes ownership checks a no-op. */
  private storageBaseUrls(): string[] {
    if (!this.config.objectStorageConfigured) {
      return [];
    }
    const bases: string[] = [];
    const publicBase = this.config.objectStoragePublicBaseUrl;
    if (publicBase !== '') {
      bases.push(publicBase.replace(/\/$/, ''));
    }
    try {
      const endpoint = new URL(this.config.objectStorageEndpoint);
      bases.push(`${endpoint.origin}/${this.config.objectStorageBucket}`);
    } catch {
      // Endpoint is URL-validated at boot (DPX-STORAGE-001 A/B); ignore if absent.
    }
    return bases;
  }

  /** (D) Throw unless `url` is a DrippleX storage URL under
   * `<base>/<folder>/<ownerId>/`. No-op when storage is unconfigured. */
  public assertOwned(url: string, opts: { folder: UploadFolder; ownerId: string }): void {
    const bases = this.storageBaseUrls();
    if (bases.length === 0) {
      return;
    }
    const owned = bases.some((base) => url.startsWith(`${base}/${opts.folder}/${opts.ownerId}/`));
    if (!owned) {
      throw new ValidationDomainException(
        `A ${opts.folder} asset must be uploaded through DrippleX and owned by this account`,
      );
    }
  }

  /** (D) Ownership check for an optional single URL (skips null/empty). */
  public assertOwnedOptional(
    url: string | null | undefined,
    opts: { folder: UploadFolder; ownerId: string },
  ): void {
    if (url !== null && url !== undefined && url !== '') {
      this.assertOwned(url, opts);
    }
  }

  /** (D) Ownership check for a list of URLs (skips null/empty entries). */
  public assertOwnedMany(
    urls: readonly (string | null | undefined)[] | null | undefined,
    opts: { folder: UploadFolder; ownerId: string },
  ): void {
    for (const url of urls ?? []) {
      this.assertOwnedOptional(url, opts);
    }
  }

  /** (F) Turn a stored DrippleX URL into a short-lived signed GET URL. Returns
   * the input unchanged when storage is unconfigured or the URL isn't a
   * recognised DrippleX storage URL. */
  public async toSignedGetUrl(url: string | null): Promise<string | null> {
    if (url === null || url === '') {
      return url;
    }
    const key = this.extractKey(url);
    if (key === null) {
      return url;
    }
    const signed = await this.storage.createPresignedGetUrl({
      key,
      expiresInSeconds: UPLOAD_SIGNED_GET_TTL_SECONDS,
    });
    return signed.url;
  }

  private extractKey(url: string): string | null {
    for (const base of this.storageBaseUrls()) {
      if (url.startsWith(`${base}/`)) {
        return url.slice(base.length + 1);
      }
    }
    return null;
  }
}
