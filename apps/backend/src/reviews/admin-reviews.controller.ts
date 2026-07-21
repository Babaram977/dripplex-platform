import { Body, Controller, Param, ParseUUIDPipe, Patch, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { ModerateReviewDto } from './dto/review-actions.dto';
import { REVIEW_PERMISSIONS } from './review.constants';
import { ReviewsService } from './reviews.service';

import type { ReviewDto } from './review.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Patch(':id/moderate')
  @RequirePermissions(REVIEW_PERMISSIONS.ADMIN_MODERATE)
  public async moderate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateReviewDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReviewDto>> {
    const data = await this.reviewsService.moderateReview(
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
