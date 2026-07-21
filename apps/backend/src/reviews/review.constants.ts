export const REVIEW_AUDIT_ACTIONS = {
  CREATED: 'review.created',
  UPDATED: 'review.updated',
  DELETED: 'review.deleted',
  HELPFUL_VOTED: 'review.helpful_voted',
  REPORTED: 'review.reported',
  MERCHANT_REPLIED: 'review.merchant_replied',
  MODERATED: 'review.moderated',
} as const;

export const REVIEW_PERMISSIONS = {
  CUSTOMER_MANAGE: 'customer:reviews:manage',
  MERCHANT_REPLY: 'merchant:reviews:reply',
  ADMIN_MODERATE: 'admin:reviews:moderate',
} as const;
