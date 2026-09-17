export const COMMISSION_CAMPAIGN_PERMISSIONS = {
  READ: 'admin:commission-campaign:read',
  MANAGE: 'admin:commission-campaign:manage',
} as const;

export const COMMISSION_CAMPAIGN_AUDIT_ACTIONS = {
  CREATED: 'commission_campaign.created',
  UPDATED: 'commission_campaign.updated',
  ACTIVATED: 'commission_campaign.activated',
  PAUSED: 'commission_campaign.paused',
  RESUMED: 'commission_campaign.resumed',
  EXPIRED: 'commission_campaign.expired',
  ARCHIVED: 'commission_campaign.archived',
  ANNOUNCED: 'commission_campaign.announced',
} as const;

/**
 * How often the sweep looks for campaigns whose window has opened or closed.
 * The same plain `setInterval` pattern as PromotionSweepService — this codebase
 * has no `@nestjs/schedule`.
 *
 * Five minutes rather than an hour: this decides what partners are charged, so
 * a campaign that was supposed to start at 9am should not still be waiting at
 * 9:55. The resolver is not dependent on the sweep for correctness — it filters
 * on the window itself — but the announcement and the status shown in Ops both
 * are.
 */
export const COMMISSION_CAMPAIGN_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** Announcements go out in batches rather than one Promise.all over everyone. */
export const COMMISSION_CAMPAIGN_ANNOUNCE_BATCH_SIZE = 200;
