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

/**
 * DPX-COMMISSION-002 — the maximum length of a commission campaign's window.
 *
 * ⚠️ SHIPS INERT. `null` means "no ceiling", which is EXACTLY today's
 * behaviour, so merging this changes nothing for any existing or future
 * campaign. It becomes a boundary only when a founder sets a number here in
 * its own reviewed change — the same pattern `RECOVERY_ACTIVATION_AT` uses for
 * the recovery backstop, and for the same reason: a financial safety boundary
 * belongs in code that is reviewed and deployed, not on a runtime surface an
 * operator can move.
 *
 * WHY THE SEAM EXISTS AT ALL. `assertWindow` bounds a campaign only by
 * `endsAt > startsAt`. There is no maximum. Meanwhile:
 *
 *   · `commissionRate` is valid at 0 — deliberately, because the negotiated
 *     merchant rate refuses zero (@Min(0.0001)) on the grounds that a partner
 *     DrippleX charges nothing is a decision with no ceiling on its cost, and
 *     a campaign is the instrument the ruling names for expressing it;
 *   · a campaign with no `rules` applies platform-wide within its scope — the
 *     sweep's own comment describes activation as telling "every merchant on
 *     the platform that the rate changed".
 *
 * Together those make PERMANENT, PLATFORM-WIDE, ZERO COMMISSION expressible in
 * one authenticated call. The zero is intended; the permanence is what nothing
 * currently bounds. "Exceptional promotional pricing, for its eligible window"
 * is the locked description of this instrument, and a window with no ceiling
 * does not express "exceptional".
 *
 * THE NUMBER IS NOT ENGINEERING'S TO CHOOSE. How long exceptional pricing may
 * run is a commercial commitment, like the Campaign → Negotiated → Platform
 * precedence it sits beside. It is left null on purpose, and this file is
 * where a founder sets it.
 *
 * WHAT A CEILING HERE DOES AND DOES NOT DO. It bounds the window a single
 * campaign may DECLARE. It does not stop an operator extending a campaign
 * repeatedly by rolling `endsAt` forward inside the limit, because `update`
 * re-validates the resulting window rather than the total time a campaign has
 * been in force. Bounding that too is a separate decision — it needs a rule
 * about cumulative duration, and possibly re-approval, neither of which is
 * implied by a maximum window. Recorded here rather than silently assumed away.
 */
export const COMMISSION_CAMPAIGN_MAX_WINDOW_MS: number | null = null;

/**
 * Resolve the ceiling, fail-OPEN.
 *
 * Deliberately the opposite of `resolveRecoveryActivationAt`, which fails
 * CLOSED. There, an unreadable boundary must stop the platform moving money by
 * itself; here, an unreadable boundary must not start refusing campaigns an
 * operator is entitled to create. An absurd value is therefore treated as "no
 * ceiling configured" — the current behaviour — rather than as zero, which
 * would refuse every campaign including a one-day one.
 */
export function resolveCommissionCampaignMaxWindowMs(
  raw: number | null = COMMISSION_CAMPAIGN_MAX_WINDOW_MS,
): number | null {
  if (raw === null) {
    return null;
  }
  if (!Number.isFinite(raw) || raw <= 0) {
    return null;
  }
  return raw;
}
