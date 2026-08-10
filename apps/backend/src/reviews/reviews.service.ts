import { allowedReviewTags } from '@dripplex/types';
import { Injectable } from '@nestjs/common';
import {
  DeliveryStatus,
  PaymentStatus,
  ReviewAuthorRole,
  ReviewStatus,
  ReviewTargetType,
} from '@prisma/client';

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
import type { SubmitRatingDto } from './dto/submit-rating.dto';
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
    return await this.persistReview(
      {
        authorId,
        authorRole: ReviewAuthorRole.CUSTOMER,
        targetType: dto.targetType,
        targetId: dto.targetId,
        orderId: dto.orderId ?? null,
        rating: dto.rating,
        comment: dto.comment,
        tags: dto.tags,
        photos: dto.photos,
        verifiedPurchase,
      },
      context,
    );
  }

  /**
   * DPX-REVIEWS-001 — a customer rates the rider who delivered a job. Resolves
   * the delivery job (must belong to this customer and be DELIVERED, with an
   * assigned rider), then creates a verified RIDER review authored by the
   * customer, targeting the rider's User.id.
   */
  public async createRiderReviewForDelivery(
    customerId: string,
    jobId: string,
    dto: SubmitRatingDto,
    context: AuditContext,
  ): Promise<ReviewDto> {
    const job = await this.prisma.deliveryJob.findFirst({
      where: { id: jobId, customerId },
      select: { id: true, riderId: true, orderId: true, status: true },
    });
    if (!job) {
      throw new NotFoundDomainException('Delivery job not found');
    }
    if (!job.riderId) {
      throw new ValidationDomainException('Delivery has no assigned rider to rate');
    }
    if (job.status !== DeliveryStatus.DELIVERED) {
      throw new ValidationDomainException(`Delivery cannot be rated from status ${job.status}`);
    }
    await this.assertNotAlreadyReviewed(
      customerId,
      ReviewTargetType.RIDER,
      job.riderId,
      job.orderId,
    );

    return await this.persistReview(
      {
        authorId: customerId,
        authorRole: ReviewAuthorRole.CUSTOMER,
        targetType: ReviewTargetType.RIDER,
        targetId: job.riderId,
        orderId: job.orderId,
        rating: dto.rating,
        comment: dto.comment,
        tags: dto.tags,
        verifiedPurchase: true,
      },
      context,
    );
  }

  /**
   * DPX-REVIEWS-001 — a merchant rates a delivery rider. Verified iff the rider
   * has delivered ≥1 order belonging to this merchant (§6 decision 2). Author
   * role is MERCHANT so the review coexists with customer→rider reviews under
   * the same RIDER target.
   */
  public async createMerchantRiderReview(
    merchantUserId: string,
    riderUserId: string,
    dto: SubmitRatingDto,
    context: AuditContext,
  ): Promise<ReviewDto> {
    await this.requireMerchantProfile(merchantUserId);
    const deliveredForMerchant = await this.prisma.deliveryJob.count({
      where: {
        riderId: riderUserId,
        merchantId: merchantUserId,
        status: DeliveryStatus.DELIVERED,
      },
    });

    return await this.persistReview(
      {
        authorId: merchantUserId,
        authorRole: ReviewAuthorRole.MERCHANT,
        targetType: ReviewTargetType.RIDER,
        targetId: riderUserId,
        orderId: null,
        rating: dto.rating,
        comment: dto.comment,
        tags: dto.tags,
        verifiedPurchase: deliveredForMerchant > 0,
      },
      context,
    );
  }

  /**
   * Shared review-persistence path: validates tags against the direction's
   * fixed set, writes the Review (starts PENDING — moderation-gated, same as
   * every other review), audits, and emits the domain event.
   */
  private async persistReview(
    params: {
      authorId: string;
      authorRole: ReviewAuthorRole;
      targetType: ReviewTargetType;
      targetId: string;
      orderId: string | null;
      rating: number;
      comment?: string | undefined;
      tags?: string[] | undefined;
      photos?: string[] | undefined;
      verifiedPurchase: boolean;
    },
    context: AuditContext,
  ): Promise<ReviewDto> {
    const tags = this.validateTags(params.targetType, params.authorRole, params.tags);

    const review = await this.prisma.review.create({
      data: {
        authorId: params.authorId,
        authorRole: params.authorRole,
        targetType: params.targetType,
        targetId: params.targetId,
        orderId: params.orderId,
        rating: params.rating,
        comment: this.optionalTrimmed(params.comment),
        tags,
        photoUrls: params.photos ?? [],
        verifiedPurchase: params.verifiedPurchase,
      },
    });

    await this.auditService.record(
      REVIEW_AUDIT_ACTIONS.CREATED,
      { ...context, userId: params.authorId },
      {
        resource: 'review',
        resourceId: review.id,
        metadata: {
          targetType: review.targetType,
          targetId: review.targetId,
          authorRole: review.authorRole,
          rating: review.rating,
          verifiedPurchase: review.verifiedPurchase,
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
      { actorUserId: params.authorId },
    );

    return toReviewDto(review);
  }

  /** Every supplied tag must belong to the direction's fixed set; unknown tags
   * are rejected. Returns the de-duplicated, trimmed tag list. */
  private validateTags(
    targetType: ReviewTargetType,
    authorRole: ReviewAuthorRole,
    tags: string[] | undefined,
  ): string[] {
    if (!tags || tags.length === 0) {
      return [];
    }
    const allowed = allowedReviewTags(targetType, authorRole);
    const cleaned = [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
    const invalid = cleaned.filter((tag) => !allowed.includes(tag));
    if (invalid.length > 0) {
      throw new ValidationDomainException(`Unknown review tag(s): ${invalid.join(', ')}`);
    }
    return cleaned;
  }

  /** Guard against a duplicate review of the same target for the same order. */
  private async assertNotAlreadyReviewed(
    authorId: string,
    targetType: ReviewTargetType,
    targetId: string,
    orderId: string | null,
  ): Promise<void> {
    const existing = await this.prisma.review.findFirst({
      where: { authorId, targetType, targetId, orderId, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new ValidationDomainException('You have already reviewed this delivery');
    }
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

  /**
   * DPX-MERCHANT-008 — `merchantUserId` is the authenticated User.id, but
   * `Review.targetId` (for MERCHANT-type reviews) and `Order.merchantId`
   * are both `MerchantProfile.id` — the same ID-space split already
   * documented for Orders/Settlement (see
   * docs/DPX-MERCHANT-002-SETTLEMENT-DESIGN.md §3). Resolving the profile
   * here, rather than comparing `merchantUserId` directly against those
   * fields, is a bug fix: the previous comparison could never match a
   * real merchant, since `merchantId` was passed straight from `user.id`
   * with no resolution step.
   */
  public async replyAsMerchant(
    merchantUserId: string,
    reviewId: string,
    dto: ReplyReviewDto,
    context: AuditContext,
  ): Promise<ReviewDto> {
    const profile = await this.requireMerchantProfile(merchantUserId);
    const review = await this.requireReview(reviewId);
    await this.assertMerchantCanReply(profile.id, review);

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        merchantReply: dto.reply.trim(),
        merchantRepliedAt: new Date(),
      },
    });
    await this.auditService.record(
      REVIEW_AUDIT_ACTIONS.MERCHANT_REPLIED,
      { ...context, userId: merchantUserId },
      {
        resource: 'review',
        resourceId: reviewId,
      },
    );
    return toReviewDto(updated);
  }

  /**
   * DPX-MERCHANT-008 — merchant-facing review list: every review that
   * targets this merchant's store directly, plus every review of a
   * product this merchant sells. Read-only; reuses the same
   * `ReviewDto`/pagination shape `listTargetReviews` already returns.
   * Scoped to APPROVED reviews only — the same visibility a customer
   * browsing the store sees, so the merchant is looking at exactly what's
   * public rather than a moderation queue (PENDING/REJECTED/HIDDEN are
   * intentionally out of scope here; see review.constants.ts's
   * `ADMIN_MODERATE` permission for that).
   */
  public async listMerchantReviews(
    merchantUserId: string,
    query: { page?: number; pageSize?: number },
  ): Promise<ReviewWithAggregateDto> {
    const profile = await this.requireMerchantProfile(merchantUserId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const productIds = await this.prisma.product.findMany({
      where: { merchantId: profile.id },
      select: { id: true },
    });

    const where: Prisma.ReviewWhereInput = {
      deletedAt: null,
      status: ReviewStatus.APPROVED,
      OR: [
        { targetType: ReviewTargetType.MERCHANT, targetId: profile.id },
        ...(productIds.length > 0
          ? [
              {
                targetType: ReviewTargetType.PRODUCT,
                targetId: { in: productIds.map((product) => product.id) },
              },
            ]
          : []),
      ],
    };

    const [items, total, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.review.count({ where }),
      this.prisma.reviewAggregate.findUnique({
        where: {
          targetType_targetId: { targetType: ReviewTargetType.MERCHANT, targetId: profile.id },
        },
      }),
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

  /** `merchantProfileId` — see the `replyAsMerchant` doc comment above for
   * why this must already be a resolved `MerchantProfile.id`, not the
   * authenticated `User.id`. */
  private async assertMerchantCanReply(merchantProfileId: string, review: Review): Promise<void> {
    if (review.targetType === ReviewTargetType.MERCHANT && review.targetId === merchantProfileId) {
      return;
    }
    if (review.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: review.orderId, merchantId: merchantProfileId },
        select: { id: true },
      });
      if (order) {
        return;
      }
    }
    throw new ForbiddenDomainException('Merchant cannot reply to this review');
  }

  private async requireMerchantProfile(userId: string): Promise<{ id: string }> {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundDomainException('Merchant profile not found');
    }
    return profile;
  }

  private optionalTrimmed(value: string | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }
}
