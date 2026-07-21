import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { ReportReviewDto } from './dto/review-actions.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { REVIEW_PERMISSIONS } from './review.constants';
import { ReviewsService } from './reviews.service';

import type { ReviewDto, ReviewListDto } from './review.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('customer/reviews')
export class CustomerReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(REVIEW_PERMISSIONS.CUSTOMER_MANAGE)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReviewDto>> {
    const data = await this.reviewsService.createReview(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get()
  @RequirePermissions(REVIEW_PERMISSIONS.CUSTOMER_MANAGE)
  public async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListReviewsQueryDto,
  ): Promise<ApiSuccessResponse<ReviewListDto>> {
    const data = await this.reviewsService.listCustomerReviews(user.id, query);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions(REVIEW_PERMISSIONS.CUSTOMER_MANAGE)
  public async getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<ReviewDto>> {
    const data = await this.reviewsService.getCustomerReview(user.id, id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions(REVIEW_PERMISSIONS.CUSTOMER_MANAGE)
  public async updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReviewDto>> {
    const data = await this.reviewsService.updateCustomerReview(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions(REVIEW_PERMISSIONS.CUSTOMER_MANAGE)
  public async deleteMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReviewDto>> {
    const data = await this.reviewsService.deleteCustomerReview(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/helpful')
  @RequirePermissions(REVIEW_PERMISSIONS.CUSTOMER_MANAGE)
  public async helpful(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReviewDto>> {
    const data = await this.reviewsService.voteHelpful(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/report')
  @RequirePermissions(REVIEW_PERMISSIONS.CUSTOMER_MANAGE)
  public async report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportReviewDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReviewDto>> {
    const data = await this.reviewsService.reportReview(
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
