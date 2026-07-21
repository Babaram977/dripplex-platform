import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { LoyaltyHistoryQueryDto, RedeemPointsDto } from './dto/loyalty.dto';
import { LOYALTY_PERMISSIONS } from './loyalty.constants';
import {
  LoyaltyService,
  type LoyaltyAccountOverview,
  type LoyaltyLedgerEntryDto,
} from './loyalty.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('customer/loyalty')
export class CustomerLoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get()
  @RequirePermissions(LOYALTY_PERMISSIONS.CUSTOMER_READ)
  public async getLoyalty(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<LoyaltyAccountOverview>> {
    const data = await this.loyaltyService.getCustomerOverview(user.id);
    return { success: true, data };
  }

  @Get('history')
  @RequirePermissions(LOYALTY_PERMISSIONS.CUSTOMER_READ)
  public async getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LoyaltyHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<LoyaltyLedgerEntryDto>>> {
    const data = await this.loyaltyService.listHistory(user.id, query.page, query.pageSize);
    return { success: true, data };
  }

  @Post('redeem')
  @RequirePermissions(LOYALTY_PERMISSIONS.CUSTOMER_REDEEM)
  public async redeem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RedeemPointsDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<LoyaltyAccountOverview>> {
    const data = await this.loyaltyService.redeemPoints(
      user.id,
      dto.points,
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
