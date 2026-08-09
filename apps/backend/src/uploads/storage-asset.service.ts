import { Inject, Injectable } from '@nestjs/common';

import { ForbiddenDomainException } from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';

import { OBJECT_STORAGE_PROVIDER, UPLOAD_SIGNED_GET_TTL_SECONDS } from './uploads.constants';

import type { ObjectStorageProvider } from './object-storage-provider.adapter';
import type { UploadFolder } from './uploads.constants';

export interface StorageOwnership {
  /** Folder prefix the asset must live under, e.g. `kyc-documents`. */
  folder: UploadFolder;
  /** The id the object key must be namespaced by (the persisting user). */
  ownerId: string;
}

/**
 * DPX-STORAGE-001 (Phase 4) — guards the two ends of the protected-asset
 * contract that Part 1 (upload authorization) did not cover:
 *
 * - **Decision D (persisted-URL ownership).** `assertOwned*` verify that a URL a
 *   client asks us to persist for a protected asset is actually a
 *   DrippleX-controlled storage URL whose server-derived key is namespaced by
 *   the owning user. This stops a client persisting an arbitrary external URL,
 *   a foreign-bucket URL, or another user's object key for a KYC / identity /
 *   vehicle / profile asset.
 * - **Decision F (private objects + signed GET).** `toSignedGetUrl*` turn a
 *   stored (canonical, non-public) object URL into a short-lived pre-signed GET
 *   URL for an already-authorized reader. Sensitive objects live in a private
 *   bucket, so the stored URL is never directly readable; callers that are
 *   permitted to view the asset receive a signed URL that expires quickly.
 *
 * Safe-until-configured (decision A): when object storage is not configured
 * (local/dev), ownership checks are a no-op and `toSignedGetUrl` returns the
 * value unchanged, so dev environments keep working with placeholder values.
 * Enforcement only kicks in once real storage is wired up.
 */
@Injectable()
export class StorageAssetService {
  constructor(
    private readonly config: AppConfigService,
    @Inject(OBJECT_STORAGE_PROVIDER)
    private readonly provider: ObjectStorageProvider,
  ) {}

  /**
   * The set of DrippleX-controlled URL prefixes a persisted asset URL may start
   * with. Mirrors how `S3CompatibleStorageProvider` builds `publicUrl` — either
   * `<publicBaseUrl>/<key>` or `<endpoint origin>/<bucket>/<key>` — so both
   * forms validate regardless of which was configured at upload time. Empty when
   * storage is not configured.
   */
  public storageBaseUrls(): string[] {
    if (!this.config.objectStorageConfigured) return [];
    const bases: string[] = [];
    const endpoint = new URL(this.config.objectStorageEndpoint);
    bases.push(`${endpoint.origin}/${this.config.objectStorageBucket}/`);
    const publicBase = this.config.objectStoragePublicBaseUrl;
    if (publicBase !== '') {
      bases.push(`${publicBase.replace(/\/$/, '')}/`);
    }
    return bases;
  }

  /**
   * Return the object key for a DrippleX-controlled storage URL, or `null` if
   * the URL is not one of ours (external host / foreign bucket / not a URL).
   */
  public extractKey(url: string): string | null {
    for (const base of this.storageBaseUrls()) {
      if (url.startsWith(base)) {
        const rest = url.slice(base.length);
        // Keys are server-derived from URL-safe characters, so no percent
        // decoding is needed; just drop any query string / fragment.
        const withoutQuery = rest.split('?')[0] ?? rest;
        return withoutQuery.split('#')[0] ?? withoutQuery;
      }
    }
    return null;
  }

  /**
   * Assert a URL a client wants persisted is a DrippleX-controlled object owned
   * by `ownerId` under `folder`. Throws `ForbiddenDomainException` for external,
   * foreign-bucket, or cross-owner URLs. No-op when storage is unconfigured.
   */
  public assertOwned(url: string, ownership: StorageOwnership): void {
    if (!this.config.objectStorageConfigured) return;

    const key = this.extractKey(url);
    if (key === null) {
      throw new ForbiddenDomainException('Asset URL is not a DrippleX-controlled storage URL');
    }

    const expectedPrefix = `${ownership.folder}/${ownership.ownerId}/`;
    if (!key.startsWith(expectedPrefix)) {
      throw new ForbiddenDomainException(
        'Asset URL does not belong to the current user or the expected folder',
      );
    }
  }

  /** `assertOwned` for an optional field: no-op when the URL is null/undefined/empty. */
  public assertOwnedOptional(url: string | null | undefined, ownership: StorageOwnership): void {
    if (url === null || url === undefined || url === '') return;
    this.assertOwned(url, ownership);
  }

  /** `assertOwned` for a list of URLs sharing one owner/folder. */
  public assertOwnedMany(
    urls: readonly (string | null | undefined)[],
    ownership: StorageOwnership,
  ): void {
    for (const url of urls) {
      this.assertOwnedOptional(url, ownership);
    }
  }

  /**
   * Convert a stored (private, canonical) object URL into a short-lived signed
   * GET URL for an already-authorized reader (decision F). Returns the value
   * unchanged when storage is unconfigured (dev) or when the URL is not a
   * DrippleX object we can sign (e.g. legacy/placeholder data) — reads never
   * fail just because an old value can't be parsed.
   */
  public async toSignedGetUrl(url: string): Promise<string> {
    if (url === '') return url;
    if (!this.config.objectStorageConfigured) return url;
    const key = this.extractKey(url);
    if (key === null) return url;
    const signed = await this.provider.createPresignedGetUrl({
      key,
      expiresInSeconds: UPLOAD_SIGNED_GET_TTL_SECONDS,
    });
    return signed.url;
  }

  /** `toSignedGetUrl` for an optional field: passes null/undefined through. */
  public async toSignedGetUrlOptional(
    url: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (url === null || url === undefined || url === '') return url;
    return await this.toSignedGetUrl(url);
  }
}
