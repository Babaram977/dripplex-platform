import { Controller, Get, Query } from '@nestjs/common';

import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { ReviewsService } from './reviews.service';

import type { ReviewWithAggregateDto } from './review.mapper';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  public async list(
    @Query() query: ListReviewsQueryDto,
  ): Promise<ApiSuccessResponse<ReviewWithAggregateDto>> {
    const data = await this.reviewsService.listTargetReviews(query);
    return { success: true, data };
  }
}
