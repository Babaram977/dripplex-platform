import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';

import { SignUploadDto } from './dto/sign-upload.dto';
import { UploadsService } from './uploads.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { SignUploadResponse } from '@dripplex/types';

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
}
