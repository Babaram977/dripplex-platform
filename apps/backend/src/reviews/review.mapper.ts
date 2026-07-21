import type { Review, ReviewAggregate, ReviewReport, ReviewVote } from '@prisma/client';

export interface ReviewDto {
  id: string;
  authorId: string;
  targetType: string;
  targetId: string;
  orderId: string | null;
  rating: number;
  comment: string | null;
  photos: string[];
  verifiedPurchase: boolean;
  status: string;
  merchantReply: string | null;
  merchantRepliedAt: string | null;
  helpfulCount: number;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewAggregateDto {
  targetType: string;
  targetId: string;
  averageRating: number;
  reviewCount: number;
  rating1: number;
  rating2: number;
  rating3: number;
  rating4: number;
  rating5: number;
  updatedAt: string;
}

export interface ReviewListDto {
  items: ReviewDto[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ReviewWithAggregateDto extends ReviewListDto {
  aggregate: ReviewAggregateDto | null;
}

export type ReviewWithRelations = Review & {
  votes?: ReviewVote[];
  reports?: ReviewReport[];
};

export function toReviewDto(review: ReviewWithRelations): ReviewDto {
  return {
    id: review.id,
    authorId: review.authorId,
    targetType: review.targetType,
    targetId: review.targetId,
    orderId: review.orderId,
    rating: review.rating,
    comment: review.comment,
    photos: review.photoUrls,
    verifiedPurchase: review.verifiedPurchase,
    status: review.status,
    merchantReply: review.merchantReply,
    merchantRepliedAt: review.merchantRepliedAt?.toISOString() ?? null,
    helpfulCount: review.helpfulCount,
    reportCount: review.reportCount,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

export function toReviewAggregateDto(aggregate: ReviewAggregate): ReviewAggregateDto {
  return {
    targetType: aggregate.targetType,
    targetId: aggregate.targetId,
    averageRating: aggregate.averageRating,
    reviewCount: aggregate.reviewCount,
    rating1: aggregate.rating1,
    rating2: aggregate.rating2,
    rating3: aggregate.rating3,
    rating4: aggregate.rating4,
    rating5: aggregate.rating5,
    updatedAt: aggregate.updatedAt.toISOString(),
  };
}
