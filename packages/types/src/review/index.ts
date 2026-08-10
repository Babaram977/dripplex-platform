// DPX-REVIEWS-001 — review tags + author role. The polymorphic Review system
// (product/merchant/rider) gains star + comment + preset tags. Tag sets are
// fixed and code-defined, keyed by the rating "direction" — i.e. the target
// being rated and the role of the author doing the rating.

import type { ReviewTargetType } from '../platform/index.js';

export type ReviewAuthorRole = 'CUSTOMER' | 'MERCHANT';

/** A rating direction = who is rated, by whom. */
export type ReviewDirection = 'CUSTOMER_TO_MERCHANT' | 'CUSTOMER_TO_RIDER' | 'MERCHANT_TO_RIDER';

/** Fixed, code-defined preset tag sets per direction (DPX-REVIEWS-001 §3). */
export const REVIEW_TAGS: Record<ReviewDirection, readonly string[]> = {
  CUSTOMER_TO_MERCHANT: [
    'Fast prep',
    'Well packaged',
    'Accurate order',
    'Great value',
    'Friendly service',
  ],
  CUSTOMER_TO_RIDER: ['On time', 'Careful with items', 'Polite', 'Good communication'],
  MERCHANT_TO_RIDER: ['Prompt pickup', 'Professional', 'Careful handling', 'Good communication'],
};

/**
 * Resolve the rating direction from a (targetType, authorRole) pair, or null
 * if the combination has no defined tag set (e.g. PRODUCT reviews carry no
 * tags). Shared by the backend validator and the UI tag pickers so both agree.
 */
export function reviewDirectionFor(
  targetType: ReviewTargetType,
  authorRole: ReviewAuthorRole,
): ReviewDirection | null {
  if (targetType === 'MERCHANT' && authorRole === 'CUSTOMER') return 'CUSTOMER_TO_MERCHANT';
  if (targetType === 'RIDER' && authorRole === 'CUSTOMER') return 'CUSTOMER_TO_RIDER';
  if (targetType === 'RIDER' && authorRole === 'MERCHANT') return 'MERCHANT_TO_RIDER';
  return null;
}

/** Allowed tag set for a direction (empty when the combination has no tags). */
export function allowedReviewTags(
  targetType: ReviewTargetType,
  authorRole: ReviewAuthorRole,
): readonly string[] {
  const direction = reviewDirectionFor(targetType, authorRole);
  return direction ? REVIEW_TAGS[direction] : [];
}

/** DPX-REVIEWS-001 — driver rating tags (customer → driver, via RideRating). */
export const DRIVER_RATING_TAGS: readonly string[] = [
  'Safe driving',
  'Clean vehicle',
  'Polite',
  'On time',
  'Great conversation',
  'Helped with bags',
];
