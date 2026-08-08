import { IsIn, IsInt, Max, Min } from 'class-validator';

import {
  UPLOAD_ALLOWED_CONTENT_TYPES,
  UPLOAD_FOLDERS,
  UPLOAD_MAX_BYTES,
  type UploadContentType,
  type UploadFolder,
} from '../uploads.constants';

export class SignUploadDto {
  @IsIn(UPLOAD_ALLOWED_CONTENT_TYPES)
  public contentType!: UploadContentType;

  @IsIn(UPLOAD_FOLDERS)
  public folder!: UploadFolder;

  /**
   * DPX-STORAGE-001 — the exact byte length of the object being uploaded.
   * Required (no longer advisory): it is rejected here when it exceeds
   * UPLOAD_MAX_BYTES, and then bound into the pre-signed URL's signature, so
   * the storage provider rejects any upload whose real length differs. The
   * cap is enforced by the signature, not trusted from the client after the
   * fact.
   */
  @IsInt()
  @Min(1)
  @Max(UPLOAD_MAX_BYTES)
  public contentLength!: number;
}
