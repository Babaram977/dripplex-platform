import { Injectable } from '@nestjs/common';
import { PaymentStatus, ReviewStatus, ReviewTargetType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';

import { REVIEW_AUDIT_ACTIONS } from './review.constants';
import {
  toReviewAggregateDto,
  toReviewDto,
  type ReviewAggregateDto,
  type ReviewDto,
  type ReviewListDto,
  type ReviewWithAggregateDto,
} from './review.mapper';

import type { CreateReviewDto } from './dto/create-review.dto';
import type { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import type { ModerateReviewDto, ReplyReviewDto, ReportReviewDto } from './dto/review-actions.dto';
import type { UpdateReviewDto } from './dto/update-review.dto';
import type { Prisma, Review } from '@prisma/client';

const AGGREGATED_REVIEW_STATUSES = [ReviewStatus.APPROVED] as const;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: DomainEventBus,
  ) {}

  public async createReview(
    authorId: string,
    dto: CreateReviewDto,
    context: AuditContext,
  ): Promise<ReviewDto> {
    const verifiedPurchase = await this.isVerifiedPurchase(authorId, dto);
    const review = await this.prisma.review.create({
      data: {
        authorId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        orderId: dto.orderId ?? null,
        rating: dto.rating,
        comment: this.optionalTrimmed(dto.comment),
        photoUrls: dto.photos ?? [],
        verifiedPurchase,
      },
    });

    await this.auditService.record(
      REVIEW_AUDIT_ACTIONS.CREATED,
      { ...context, userId: authorId },
      {
        resource: 'review',
        resourceId: review.id,
        metadata: {
          targetType: review.targetType,
          targetId: review.targetId,
          rating: review.rating,
          verifiedPurchase,
        },
      },
    );

    await this.eventBus.emit(
      DOMAIN_EVENTS.REVIEW_SUBMITTED,
      {
        reviewId: review.id,
        targetType: review.targetType,
        targetId: review.targetId,
        rating: review.rating,
      },
      { actorUserId: authorId },
    );

    return toReviewDto(review);
  }

  public async listTargetReviews(query: ListReviewsQueryDto): Promise<ReviewWithAggregateDto> {
    if ((query.targetType === undefined) !== (query.targetId === undefined)) {
      throw new ValidationDomainException('targetType and targetId must be provided together');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ReviewWhereInput = {
      deletedAt: null,
      status: query.status ?? ReviewStatus.APPROVED,
      ...(query.targetType !== undefined ? { targetType: query.targetType } : {}),
      ...(query.targetId !== undefined ? { targetId: query.targetId } : {}),
    };

    const [items, total, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.review.count({ where }),
      query.targetType !== undefined && query.targetId !== undefined
        ? this.prisma.reviewAggregate.findUnique({
            where: {
              targetType_targetId: { targetType: query.targetType, targetId: query.targetId },
            },
          })
        : Promise.resolve(null),
    ]);

    return {
      items: items.map(toReviewDto),
      aggregate: aggregate ? toReviewAggregateDto(aggregate) : null,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  public async listCustomerReviews(
    authorId: string,
    query: ListReviewsQueryDto,
  ): Promise<ReviewListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ReviewWhereInput = {
      authorId,
      deletedAt: null,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.targetType !== undefined ? { targetType: query.targetType } : {}),
      ...(query.targetId !== undefined ? { targetId: query.targetId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: items.map(toReviewDto),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  public async getCustomerReview(authorId: string, reviewId: string): Promise<ReviewDto> {
    return toReviewDto(await this.requireCustomerReview(authorId, reviewId));
  }

  public async updateCustomerReview(
    authorId: string,
    reviewId: string,
    dto: UpdateReviewDto,
    context: AuditContext,
  ): Promise<ReviewDto> {
    await this.requireCustomerReview(authorId, reviewId);

    const update: Prisma.ReviewUpdateInput = {};
    if (dto.rating !== undefined) {
      update.rating = dto.rating;
      update.status = ReviewStatus.PENDING;
    }
    if (dto.comment !== undefined) {
      update.comment = this.optionalTrimmed(dto.comment);
    }
    if (dto.photos !== undefined) {
      update.photoUrls = dto.photos;
    }

    if (Object.keys(update).length === 0) {
      throw new ValidationDomainException('At least one review field must be updated');
    }

    const updated = await this.prisma.review.update({ where: { id: reviewId }, data: update });
    await this.recalculateAggregate(updated.targetType, updated.targetId);
    await this.auditService.record(
      REVIEW_AUDIT_ACTIONS.UPDATED,
      { ...context, userId: authorId },
      {
        resource: 'review',
        resourceId: reviewId,
        metadata: { rating: updated.rating, status: updated.status },
      },
    );

    return toReviewDto(updated);
  }

  public async deleteCustomerReview(
    authorId: string,
    reviewId: string,
    context: AuditContext,
  ): Promise<ReviewDto> {
    await this.requireCustomerReview(authorId, reviewId);
    const deleted = await this.prisma.review.update({
      where: { id: reviewId },
      data: { deletedAt: new Date() },
    });
    await this.recalculateAggregate(deleted.targetType, deleted.targetId);
    await this.auditService.record(
      REVIEW_AUDIT_ACTIONS.DELETED,
      { ...context, userId: authorId },
      {
        resource: 'review',
        resourceId: reviewId,
      },
    );
    return toReviewDto(deleted);
  }

  public async voteHelpful(
    userId: string,
    reviewId: string,
    context: AuditContext,
  ): Promise<ReviewDto> {
    await this.requireReview(reviewId);
    await this.prisma.reviewVote.upsert({
      where: { reviewId_userId: { reviewId, userId } },
      update: { helpful: true },
      create: { reviewId, userId, helpful: true },
    });
    const helpfulCount = await this.prisma.reviewVote.count({ where: { reviewId, helpful: true } });
    const review = await this.prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount },
    });
    await this.auditService.record(
      REVIEW_AUDIT_ACTIONS.HELPFUL_VOTED,
      { ...context, userId },
      {
        resource: 'review',
        resourceId: reviewId,
      },
    );
    return toReviewDto(review);
  }

  public async reportReview(
    reporterId: string,
    reviewId: string,
    dto: ReportReviewDto,
    context: AuditContext,
  ): Promise<ReviewDto> {
    await this.requireReview(reviewId);
    await this.prisma.reviewReport.create({
      data: {
        reviewId,
        reporterId,
        reason: dto.reason.trim(),
      },
    });
    const reportCount = await this.prisma.reviewReport.count({ where: { reviewId } });
    const review = await this.prisma.review.update({
      where: { id: reviewId },
      data: { reportCount },
    });
    await this.auditService.record(
      REVIEW_AUDIT_ACTIONS.REPORTED,
      { ...context, userId: reporterId },
      {
        resource: 'review',
        resourceId: reviewId,
        metadata: { reason: dto.reason.trim() },
      },
    );
    return toReviewDto(review);
  }

  public async replyAsMerchant(
    merchantId: string,
    reviewId: string,
    dto: ReplyReviewDto,
    context: AuditContext,
  ): Promise<ReviewDto> {
    const review = await this.requireReview(reviewId);
    await this.assertMerchantCanReply(merchantId, review);

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        merchantReply: dto.reply.trim(),
        merchantRepliedAt: new Date(),
      },
    });
    await this.auditService.record(
      REVIEW_AUDIT_ACTIONS.MERCHANT_REPLIED,
      { ...context, userId: merchantId },
      {
        resource: 'review',
        resourceId: reviewId,
      },
    );
    return toReviewDto(updated);
  }

  public async moderateReview(
    adminId: string,
    reviewId: string,
    dto: ModerateReviewDto,
    context: AuditContext,
  ): Promise<ReviewDto> {
    const allowedStatuses: ReviewStatus[] = [
      ReviewStatus.APPROVED,
      ReviewStatus.REJECTED,
      ReviewStatus.HIDDEN,
    ];
    if (!allowedStatuses.includes(dto.status)) {
      throw new ValidationDomainException('Review can only be approved, rejected, or hidden');
    }
    await this.requireReview(reviewId);
    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { status: dto.status },
    });
    await this.recalculateAggregate(updated.targetType, updated.targetId);
    await this.auditService.record(
      REVIEW_AUDIT_ACTIONS.MODERATED,
      { ...context, userId: adminId },
      {
        resource: 'review',
        resourceId: reviewId,
        metadata: { status: dto.status, reason: dto.reason ?? null },
      },
    );
    return toReviewDto(updated);
  }

  public async getAggregate(
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<ReviewAggregateDto | null> {
    const aggregate = await this.prisma.reviewAggregate.findUnique({
      where: { targetType_targetId: { targetType, targetId } },
    });
    return aggregate ? toReviewAggregateDto(aggregate) : null;
  }

  public async recalculateAggregate(
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<ReviewAggregateDto> {
    const reviews = await this.prisma.review.findMany({
      where: {
        targetType,
        targetId,
        deletedAt: null,
        status: { in: [...AGGREGATED_REVIEW_STATUSES] },
      },
      select: { rating: true },
    });

    const counts = { rating1: 0, rating2: 0, rating3: 0, rating4: 0, rating5: 0 };
    let total = 0;
    for (const review of reviews) {
      total += review.rating;
      if (review.rating === 1) {
        counts.rating1 += 1;
      } else if (review.rating === 2) {
        counts.rating2 += 1;
      } else if (review.rating === 3) {
        counts.rating3 += 1;
      } else if (review.rating === 4) {
        counts.rating4 += 1;
      } else if (review.rating === 5) {
        counts.rating5 += 1;
      }
    }
    const reviewCount = reviews.length;
    const averageRating =
      reviewCount === 0 ? 0 : Math.round((total / reviewCount + Number.EPSILON) * 100) / 100;

    const aggregate = await this.prisma.reviewAggregate.upsert({
      where: { targetType_targetId: { targetType, targetId } },
      update: { averageRating, reviewCount, ...counts },
      create: { targetType, targetId, averageRating, reviewCount, ...counts },
    });
    return toReviewAggregateDto(aggregate);
  }

  private async requireReview(reviewId: string): Promise<Review> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
    });
    if (!review) {
      throw new NotFoundDomainException('Review not found');
    }
    return review;
  }

  private async requireCustomerReview(authorId: string, reviewId: string): Promise<Review> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, authorId, deletedAt: null },
    });
    if (!review) {
      throw new NotFoundDomainException('Review not found');
    }
    return review;
  }

  private async isVerifiedPurchase(authorId: string, dto: CreateReviewDto): Promise<boolean> {
    if (!dto.orderId) {
      return false;
    }

    const where: Prisma.OrderWhereInput = {
      id: dto.orderId,
      customerId: authorId,
      paymentStatus: PaymentStatus.PAID,
    };

    if (dto.targetType === ReviewTargetType.PRODUCT) {
      where.items = { some: { productId: dto.targetId } };
    } else if (dto.targetType === ReviewTargetType.MERCHANT) {
      where.merchantId = dto.targetId;
    } else {
      where.deliveryJobs = { some: { riderId: dto.targetId } };
    }

    return (await this.prisma.order.count({ where })) > 0;
  }

  private async assertMerchantCanReply(merchantId: string, review: Review): Promise<void> {
    if (review.targetType === ReviewTargetType.MERCHANT && review.targetId === merchantId) {
      return;
    }
    if (review.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: review.orderId, merchantId },
        select: { id: true },
      });
      if (order) {
        return;
      }
    }
    throw new ForbiddenDomainException('Merchant cannot reply to this review');
  }

  private optionalTrimmed(value: string | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }
}
