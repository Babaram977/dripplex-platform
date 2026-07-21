import { PaymentStatus, ReviewStatus, ReviewTargetType } from '@prisma/client';

import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { ReviewsService } from './reviews.service';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';
import type { Review } from '@prisma/client';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const reviewId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const targetId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const orderId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const now = new Date('2026-01-01T00:00:00.000Z');

const review = (overrides: Partial<Review> = {}): Review => ({
  id: reviewId,
  authorId: userId,
  targetType: ReviewTargetType.PRODUCT,
  targetId,
  orderId: null,
  rating: 5,
  comment: 'Great',
  photoUrls: [],
  verifiedPurchase: false,
  status: ReviewStatus.PENDING,
  merchantReply: null,
  merchantRepliedAt: null,
  helpfulCount: 0,
  reportCount: 0,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  ...overrides,
});

describe('ReviewsService', () => {
  const prisma = {
    review: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    reviewAggregate: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    reviewVote: {
      upsert: jest.fn(),
      count: jest.fn(),
    },
    reviewReport: {
      create: jest.fn(),
      count: jest.fn(),
    },
    order: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const eventBus = {
    on: jest.fn(),
    emit: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<DomainEventBus>;

  const service = new ReviewsService(prisma as unknown as PrismaService, auditService, eventBus);
  const context = { userId, ipAddress: '127.0.0.1' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes to review submitted events on module init', () => {
    service.onModuleInit();
    expect(eventBus.on).toHaveBeenCalledWith('ReviewSubmitted', expect.any(Function));
  });

  it('creates a review and emits REVIEW_SUBMITTED', async () => {
    prisma.order.count.mockResolvedValue(0);
    prisma.review.create.mockResolvedValue(review());

    const result = await service.createReview(
      userId,
      {
        targetType: ReviewTargetType.PRODUCT,
        targetId,
        rating: 5,
        comment: ' Great ',
      },
      context,
    );

    expect(result.rating).toBe(5);
    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ comment: 'Great', verifiedPurchase: false }),
      }),
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      'ReviewSubmitted',
      expect.objectContaining({ reviewId, targetId }),
      { actorUserId: userId },
    );
  });

  it('marks product reviews verified when paid order contains product', async () => {
    prisma.order.count.mockResolvedValue(1);
    prisma.review.create.mockResolvedValue(review({ orderId, verifiedPurchase: true }));

    await service.createReview(
      userId,
      { targetType: ReviewTargetType.PRODUCT, targetId, orderId, rating: 4 },
      context,
    );

    expect(prisma.order.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: orderId,
        customerId: userId,
        paymentStatus: PaymentStatus.PAID,
        items: { some: { productId: targetId } },
      }),
    });
  });

  it('lists approved target reviews with aggregate', async () => {
    prisma.review.findMany.mockResolvedValue([review({ status: ReviewStatus.APPROVED })]);
    prisma.review.count.mockResolvedValue(1);
    prisma.reviewAggregate.findUnique.mockResolvedValue({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      targetType: ReviewTargetType.PRODUCT,
      targetId,
      averageRating: 5,
      reviewCount: 1,
      rating1: 0,
      rating2: 0,
      rating3: 0,
      rating4: 0,
      rating5: 1,
      updatedAt: now,
    });

    const result = await service.listTargetReviews({
      targetType: ReviewTargetType.PRODUCT,
      targetId,
    });

    expect(result.items).toHaveLength(1);
    expect(result.aggregate?.averageRating).toBe(5);
  });

  it('rejects target list queries missing one target part', async () => {
    await expect(
      service.listTargetReviews({ targetType: ReviewTargetType.PRODUCT }),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('updates a customer review and resets status to pending when rating changes', async () => {
    prisma.review.findFirst.mockResolvedValue(review());
    prisma.review.update.mockResolvedValue(review({ rating: 3, status: ReviewStatus.PENDING }));
    prisma.review.findMany.mockResolvedValue([review({ rating: 3 })]);
    prisma.reviewAggregate.upsert.mockResolvedValue({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      targetType: ReviewTargetType.PRODUCT,
      targetId,
      averageRating: 3,
      reviewCount: 1,
      rating1: 0,
      rating2: 0,
      rating3: 1,
      rating4: 0,
      rating5: 0,
      updatedAt: now,
    });

    await service.updateCustomerReview(userId, reviewId, { rating: 3 }, context);

    expect(prisma.review.update).toHaveBeenCalledWith({
      where: { id: reviewId },
      data: { rating: 3, status: ReviewStatus.PENDING },
    });
  });

  it('rejects empty customer review updates', async () => {
    prisma.review.findFirst.mockResolvedValue(review());
    await expect(
      service.updateCustomerReview(userId, reviewId, {}, context),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('soft deletes owned reviews and recalculates aggregate', async () => {
    prisma.review.findFirst.mockResolvedValue(review());
    prisma.review.update.mockResolvedValue(review({ deletedAt: now }));
    prisma.review.findMany.mockResolvedValue([]);
    prisma.reviewAggregate.upsert.mockResolvedValue({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      targetType: ReviewTargetType.PRODUCT,
      targetId,
      averageRating: 0,
      reviewCount: 0,
      rating1: 0,
      rating2: 0,
      rating3: 0,
      rating4: 0,
      rating5: 0,
      updatedAt: now,
    });

    await service.deleteCustomerReview(userId, reviewId, context);

    expect(prisma.review.update).toHaveBeenCalledWith({
      where: { id: reviewId },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('upserts helpful votes and stores current helpful count', async () => {
    prisma.review.findFirst.mockResolvedValue(review());
    prisma.reviewVote.upsert.mockResolvedValue({ id: 'vote' });
    prisma.reviewVote.count.mockResolvedValue(2);
    prisma.review.update.mockResolvedValue(review({ helpfulCount: 2 }));

    const result = await service.voteHelpful(userId, reviewId, context);

    expect(result.helpfulCount).toBe(2);
    expect(prisma.reviewVote.upsert).toHaveBeenCalled();
  });

  it('creates abuse reports and stores current report count', async () => {
    prisma.review.findFirst.mockResolvedValue(review());
    prisma.reviewReport.create.mockResolvedValue({ id: 'report' });
    prisma.reviewReport.count.mockResolvedValue(1);
    prisma.review.update.mockResolvedValue(review({ reportCount: 1 }));

    const result = await service.reportReview(userId, reviewId, { reason: 'Spam' }, context);

    expect(result.reportCount).toBe(1);
    expect(prisma.reviewReport.create).toHaveBeenCalledWith({
      data: { reviewId, reporterId: userId, reason: 'Spam' },
    });
  });

  it('allows a merchant to reply to merchant target reviews', async () => {
    prisma.review.findFirst.mockResolvedValue(
      review({ targetType: ReviewTargetType.MERCHANT, targetId: userId }),
    );
    prisma.review.update.mockResolvedValue(review({ merchantReply: 'Thanks' }));

    const result = await service.replyAsMerchant(userId, reviewId, { reply: 'Thanks' }, context);

    expect(result.merchantReply).toBe('Thanks');
  });

  it('moderates reviews and recalculates aggregate', async () => {
    prisma.review.findFirst.mockResolvedValue(review());
    prisma.review.update.mockResolvedValue(review({ status: ReviewStatus.REJECTED }));
    prisma.review.findMany.mockResolvedValue([]);
    prisma.reviewAggregate.upsert.mockResolvedValue({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      targetType: ReviewTargetType.PRODUCT,
      targetId,
      averageRating: 0,
      reviewCount: 0,
      rating1: 0,
      rating2: 0,
      rating3: 0,
      rating4: 0,
      rating5: 0,
      updatedAt: now,
    });

    const result = await service.moderateReview(
      userId,
      reviewId,
      { status: ReviewStatus.REJECTED },
      context,
    );

    expect(result.status).toBe(ReviewStatus.REJECTED);
  });

  it('rejects moderation back to pending', async () => {
    await expect(
      service.moderateReview(userId, reviewId, { status: ReviewStatus.PENDING }, context),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('recalculates aggregate counts and averages', async () => {
    prisma.review.findMany.mockResolvedValue([{ rating: 5 }, { rating: 4 }, { rating: 1 }]);
    prisma.reviewAggregate.upsert.mockResolvedValue({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      targetType: ReviewTargetType.PRODUCT,
      targetId,
      averageRating: 3.33,
      reviewCount: 3,
      rating1: 1,
      rating2: 0,
      rating3: 0,
      rating4: 1,
      rating5: 1,
      updatedAt: now,
    });

    const result = await service.recalculateAggregate(ReviewTargetType.PRODUCT, targetId);

    expect(result.averageRating).toBe(3.33);
    expect(prisma.reviewAggregate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ reviewCount: 3, rating5: 1 }),
      }),
    );
  });

  it('throws when customer review is not found', async () => {
    prisma.review.findFirst.mockResolvedValue(null);
    await expect(service.getCustomerReview(userId, reviewId)).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });
});
