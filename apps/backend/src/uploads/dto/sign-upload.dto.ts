import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

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
   * Optional declared byte size, rejected here when it exceeds the cap. This is
   * an early client-side guard; pre-signed PUT URLs cannot themselves enforce a
   * hard size limit, which is a bucket-policy concern (documented follow-up).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(UPLOAD_MAX_BYTES)
  public contentLength?: number;
}
