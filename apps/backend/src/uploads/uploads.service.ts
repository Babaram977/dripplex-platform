import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ForbiddenDomainException } from '../common/exceptions/domain.exception';

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
}
