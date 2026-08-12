import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ValidationDomainException } from '../common/exceptions/domain.exception';

import { SignUploadDto } from './dto/sign-upload.dto';
import { UPLOAD_MAX_BYTES } from './uploads.constants';
import { UploadsService } from './uploads.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { SignUploadResponse } from '@dripplex/types';

// Minimal Multer file shape (avoids a hard dependency on @types/multer).
interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

/**
 * POST /uploads/sign — cross-cutting signed-upload endpoint. Requires
 * authentication (global JwtAuthGuard); the signed URL only grants a write to a
 * key namespaced under the caller's own user id, within the allowed
 * folders/content-types. DPX-STORAGE-001 (G): the target folder is further
 * least-privilege gated — a folder with required permissions (e.g. kyc-documents,
 * vehicle-photos, identity-verification) may only be signed by a caller holding
 * one of them (enforced in UploadsService from the authenticated user's
 * permissions), so folder is not an arbitrary client choice.
 */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('sign')
  @HttpCode(HttpStatus.OK)
  public async sign(
    @Body() dto: SignUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<SignUploadResponse>> {
    const data = await this.uploadsService.sign(user.id, user.permissions, dto);
    return { success: true, data };
  }

  /**
   * POST /uploads/direct — multipart proxy upload. The browser sends the file to
   * our API (same origin it already talks to) and the backend streams it to
   * object storage, so uploads don't depend on browser→R2 CORS. Same auth +
   * least-privilege folder gating as /uploads/sign.
   */
  @Post('direct')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_MAX_BYTES } }))
  public async direct(
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body('folder') folder: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<{ publicUrl: string; key: string }>> {
    if (!file) {
      throw new ValidationDomainException('No file was uploaded');
    }
    if (typeof folder !== 'string' || folder.length === 0) {
      throw new ValidationDomainException('folder is required');
    }
    const data = await this.uploadsService.uploadDirect(user.id, user.permissions, {
      folder,
      contentType: file.mimetype,
      size: file.size,
      body: file.buffer,
    });
    return { success: true, data };
  }
}
