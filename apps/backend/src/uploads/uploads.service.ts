import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  ForbiddenDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import {
  CONTENT_TYPE_EXTENSION,
  OBJECT_STORAGE_PROVIDER,
  UPLOAD_FOLDER_PERMISSIONS,
  UPLOAD_MAX_BYTES,
  UPLOAD_URL_TTL_SECONDS,
} from './uploads.constants';

import type { SignUploadDto } from './dto/sign-upload.dto';
import type { ObjectStorageProvider } from './object-storage-provider.adapter';
import type { SignUploadResponse } from '@dripplex/types';

/**
 * Issues short-lived pre-signed upload URLs. The object key is always namespaced
 * by the authenticated user's id so one user can never target another user's
 * path, and the extension is chosen server-side from the validated content type
 * (never from client-supplied file names) to keep keys predictable and safe.
 */
@Injectable()
export class UploadsService {
  constructor(
    @Inject(OBJECT_STORAGE_PROVIDER)
    private readonly storage: ObjectStorageProvider,
  ) {}

  public async sign(
    userId: string,
    permissions: readonly string[],
    dto: SignUploadDto,
  ): Promise<SignUploadResponse> {
    // DPX-STORAGE-001 (G) — least-privilege folder access. A folder with a
    // non-empty permission list may only be signed by a caller holding one of
    // them, so folder is not an arbitrary client choice.
    const required = UPLOAD_FOLDER_PERMISSIONS[dto.folder];
    if (required.length > 0 && !required.some((permission) => permissions.includes(permission))) {
      throw new ForbiddenDomainException(
        `You are not permitted to upload to the '${dto.folder}' folder`,
      );
    }

    const extension = CONTENT_TYPE_EXTENSION[dto.contentType];
    const key = `${dto.folder}/${userId}/${randomUUID()}.${extension}`;

    const presigned = await this.storage.createPresignedPutUrl({
      key,
      contentType: dto.contentType,
      contentLength: dto.contentLength,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });

    return {
      uploadUrl: presigned.uploadUrl,
      method: 'PUT',
      key: presigned.key,
      publicUrl: presigned.publicUrl,
      expiresAt: presigned.expiresAt,
      maxBytes: UPLOAD_MAX_BYTES,
      // Both are now signed into the URL — the client MUST send them exactly or
      // the storage provider rejects the upload (DPX-STORAGE-001).
      requiredHeaders: {
        'Content-Type': dto.contentType,
        'Content-Length': String(dto.contentLength),
      },
    };
  }

  /**
   * Server-side (proxy) upload. The browser POSTs the file bytes to our API and
   * the backend streams them to object storage itself, so the upload never
   * depends on the browser being allowed to PUT cross-origin to R2 (which needs
   * bucket CORS the app doesn't control). Same least-privilege folder gating and
   * server-chosen key/extension as sign(); returns the stored public URL.
   */
  public async uploadDirect(
    userId: string,
    permissions: readonly string[],
    input: { folder: string; contentType: string; size: number; body: Buffer },
  ): Promise<{ publicUrl: string; key: string }> {
    if (!Object.prototype.hasOwnProperty.call(UPLOAD_FOLDER_PERMISSIONS, input.folder)) {
      throw new ValidationDomainException(`Unknown upload folder '${input.folder}'`);
    }
    const required =
      UPLOAD_FOLDER_PERMISSIONS[input.folder as keyof typeof UPLOAD_FOLDER_PERMISSIONS];
    if (required.length > 0 && !required.some((permission) => permissions.includes(permission))) {
      throw new ForbiddenDomainException(
        `You are not permitted to upload to the '${input.folder}' folder`,
      );
    }

    if (!Object.prototype.hasOwnProperty.call(CONTENT_TYPE_EXTENSION, input.contentType)) {
      throw new ValidationDomainException(`Unsupported file type '${input.contentType}'`);
    }
    const extension =
      CONTENT_TYPE_EXTENSION[input.contentType as keyof typeof CONTENT_TYPE_EXTENSION];
    if (input.size <= 0 || input.size > UPLOAD_MAX_BYTES) {
      throw new ValidationDomainException(
        `File must be between 1 byte and ${String(UPLOAD_MAX_BYTES)} bytes`,
      );
    }

    const key = `${input.folder}/${userId}/${randomUUID()}.${extension}`;
    const presigned = await this.storage.createPresignedPutUrl({
      key,
      contentType: input.contentType,
      contentLength: input.size,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });

    // Server-to-server PUT — no browser/CORS involved. The signature binds
    // content-type + content-length, so send them exactly.
    const res = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      body: input.body,
      headers: {
        'Content-Type': input.contentType,
        'Content-Length': String(input.size),
      },
    });
    if (!res.ok) {
      throw new ValidationDomainException(
        `Object storage rejected the upload (${String(res.status)})`,
      );
    }

    return { publicUrl: presigned.publicUrl, key: presigned.key };
  }
}
