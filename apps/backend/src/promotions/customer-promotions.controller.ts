import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import {
  ListPromotionsQueryDto,
  RedeemPromotionDto,
  ValidatePromotionDto,
} from './dto/promotion.dto';
import { PROMOTION_PERMISSIONS } from './promotion.constants';
import { PromotionsService } from './promotions.service';

import type {
  PromotionDto,
  PromotionEvaluationDto,
  PromotionRedemptionDto,
} from './promotion.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('customer/promotions')
export class CustomerPromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('active')
  @RequirePermissions(PROMOTION_PERMISSIONS.CUSTOMER_USE)
  public async active(
    @Query() query: ListPromotionsQueryDto,
  ): Promise<ApiSuccessResponse<PromotionDto[]>> {
    const data = await this.promotionsService.listActive(query.merchantId);
    return { success: true, data };
  }

  @Post('validate')
  @RequirePermissions(PROMOTION_PERMISSIONS.CUSTOMER_USE)
  public async validate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ValidatePromotionDto,
  ): Promise<ApiSuccessResponse<PromotionEvaluationDto>> {
    const data = await this.promotionsService.validateCoupon({
      subtotal: dto.subtotal,
      userId: user.id,
      ...(dto.merchantId !== undefined ? { merchantId: dto.merchantId } : {}),
      ...(dto.couponCode !== undefined ? { couponCode: dto.couponCode } : {}),
    });
    return { success: true, data };
  }

  @Post('redeem')
  @RequirePermissions(PROMOTION_PERMISSIONS.CUSTOMER_USE)
  public async redeem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RedeemPromotionDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PromotionRedemptionDto>> {
    const data = await this.promotionsService.redeem(
      user.id,
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
