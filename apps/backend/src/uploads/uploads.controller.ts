import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';

import { SignUploadDto } from './dto/sign-upload.dto';
import { UploadsService } from './uploads.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { SignUploadResponse } from '@dripplex/types';

/**
 * POST /uploads/sign — cross-cutting signed-upload endpoint. Available to any
 * authenticated user (no per-resource permission): a signed URL only grants a
 * write to a key namespaced under the caller's own user id, within the allowed
 * folders/content-types. If finer role-scoping is ever required it can be added
 * as a @RequirePermissions gate + seed grant without changing the contract.
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
    const data = await this.uploadsService.sign(user.id, dto);
    return { success: true, data };
  }
}
