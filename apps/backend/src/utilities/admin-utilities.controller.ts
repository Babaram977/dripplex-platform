import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import { UtilityPurchaseStatus } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { AdminUtilityPurchaseQueryDto, ResolveUtilityPurchaseDto } from './dto/utilities.dto';
import { UTILITIES_PERMISSIONS } from './utilities.constants';
import {
  UtilitiesService,
  type AdminUtilityPurchaseDto,
  type UtilityFloatStatusDto,
} from './utilities.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/utilities')
export class AdminUtilitiesController {
  constructor(private readonly utilitiesService: UtilitiesService) {}

  /**
   * The Peyflex float, and whether it is running out.
   *
   * Ops needs this before launch, not after the first outage: the float is
   * shared by every utility purchase on the platform, so it hitting zero
   * fails all four services at once and presents to customers as a generic
   * error with no clue as to the cause.
   */
  @Get('float')
  @RequirePermissions(UTILITIES_PERMISSIONS.ADMIN_MANAGE)
  public async float(): Promise<ApiSuccessResponse<UtilityFloatStatusDto>> {
    return { success: true, data: await this.utilitiesService.getFloatStatus() };
  }

  @Get('purchases')
  @RequirePermissions(UTILITIES_PERMISSIONS.ADMIN_MANAGE)
  public async purchases(
    @Query() query: AdminUtilityPurchaseQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<AdminUtilityPurchaseDto>>> {
    const data = await this.utilitiesService.listAllPurchases(query.page, query.pageSize, {
      ...(query.serviceType !== undefined ? { serviceType: query.serviceType } : {}),
      ...(query.status !== undefined ? { status: UtilityPurchaseStatus[query.status] } : {}),
    });
    return { success: true, data };
  }

  /**
   * Record what a human found on the Peyflex dashboard for a purchase the
   * provider never answered for.
   *
   * This endpoint exists because of a documented provider gap, not a design
   * preference: Peyflex accepts no client idempotency key and offers no
   * transaction-status lookup for these four services, so after a timeout
   * only a person can establish whether the float was spent.
   */
  @Patch('purchases/:id/resolve')
  @RequirePermissions(UTILITIES_PERMISSIONS.ADMIN_MANAGE)
  public async resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveUtilityPurchaseDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AdminUtilityPurchaseDto>> {
    const data = await this.utilitiesService.resolvePendingPurchase(
      id,
      dto,
      this.auditContext(request, user.id),
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
