import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { ListMerchantReviewsQueryDto } from './dto/list-merchant-reviews-query.dto';
import { ReplyReviewDto } from './dto/review-actions.dto';
import { REVIEW_PERMISSIONS } from './review.constants';
import { ReviewsService } from './reviews.service';

import type { ReviewDto, ReviewWithAggregateDto } from './review.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('merchant/reviews')
@RequirePermissions(REVIEW_PERMISSIONS.MERCHANT_REPLY)
export class MerchantReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  public async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMerchantReviewsQueryDto,
  ): Promise<ApiSuccessResponse<ReviewWithAggregateDto>> {
    const data = await this.reviewsService.listMerchantReviews(user.id, query);
    return { success: true, data };
  }

  @Post(':id/reply')
  public async reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyReviewDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReviewDto>> {
    const data = await this.reviewsService.replyAsMerchant(
      user.id,
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
