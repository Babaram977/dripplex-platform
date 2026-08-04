import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { DriverVerificationTrigger } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { DriverIdentityVerificationService } from '../identity-verification/driver-identity-verification.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { Request } from 'express';

/**
 * DPX-DS-001 — the "security team flags the account" and "support review"
 * steps from the founder's verification flow diagram. Admin-only.
 */
@Controller('admin/drivers/:id/identity-verification')
@RequirePermissions(DRIVER_PERMISSIONS.ADMIN_IDENTITY_VERIFICATION_MANAGE)
export class AdminDriverIdentityVerificationController {
  constructor(private readonly identityVerificationService: DriverIdentityVerificationService) {}

  @Post('require')
  @HttpCode(HttpStatus.OK)
  public async require(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ required: true }>> {
    await this.identityVerificationService.requireVerification(
      id,
      DriverVerificationTrigger.MANUAL_ADMIN,
      { userId: admin.id, ...(request.ip !== undefined ? { ipAddress: request.ip } : {}) },
    );
    return { success: true, data: { required: true } };
  }

  @Post('unlock')
  @HttpCode(HttpStatus.OK)
  public async unlock(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ unlocked: true }>> {
    await this.identityVerificationService.unlock(id, {
      userId: admin.id,
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
    });
    return { success: true, data: { unlocked: true } };
  }
}
