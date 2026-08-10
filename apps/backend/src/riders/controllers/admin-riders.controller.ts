import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RejectRiderDto, SuspendRiderDto } from '../dto/admin-rider-actions.dto';
import { ListRidersQueryDto } from '../dto/list-riders-query.dto';
import { RIDER_PERMISSIONS } from '../rider.constants';
import { RidersService } from '../riders.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { RiderApprovalDto, RiderProfileDto } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-RIDER-001 — rider approval desk. Same `@Controller('admin')` surface and
 * `admin:*` permission model as AdminDriversController, so operations_staff
 * (which already holds admin:drivers:* / admin:merchants:*) reaches these in
 * the Operations Console once granted admin:riders:*.
 */
@Controller('admin')
export class AdminRidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Get('riders')
  @RequirePermissions(RIDER_PERMISSIONS.REVIEW)
  public async listRiders(@Query() query: ListRidersQueryDto): Promise<
    ApiSuccessResponse<{
      items: RiderProfileDto[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>
  > {
    const data = await this.ridersService.listRiders(query);
    return { success: true, data };
  }

  @Get('rider/:id')
  @RequirePermissions(RIDER_PERMISSIONS.REVIEW)
  public async getRider(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<RiderProfileDto>> {
    const data = await this.ridersService.getRiderProfile(id);
    return { success: true, data };
  }

  @Post('rider/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(RIDER_PERMISSIONS.APPROVE)
  public async approveRider(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RiderApprovalDto>> {
    const data = await this.ridersService.approveRider(
      id,
      admin.id,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post('rider/:id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(RIDER_PERMISSIONS.REJECT)
  public async rejectRider(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRiderDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RiderApprovalDto>> {
    const data = await this.ridersService.rejectRider(
      id,
      admin.id,
      dto.reason,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post('rider/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(RIDER_PERMISSIONS.SUSPEND)
  public async suspendRider(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendRiderDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RiderApprovalDto>> {
    const data = await this.ridersService.suspendRider(
      id,
      admin.id,
      dto.reason,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post('rider/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(RIDER_PERMISSIONS.REACTIVATE)
  public async reactivateRider(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RiderApprovalDto>> {
    const data = await this.ridersService.reactivateRider(
      id,
      admin.id,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  private auditContext(
    request: Request,
    userId?: string,
  ): { userId?: string; ipAddress?: string; userAgent?: string } {
    return {
      ...(userId !== undefined ? { userId } : {}),
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
