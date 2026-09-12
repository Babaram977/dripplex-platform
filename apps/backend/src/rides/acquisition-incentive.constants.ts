/**
 * DPX-PROMO-REF-001 — the universal new-customer acquisition incentive.
 *
 * The promotion row itself is seeded by
 * `20260913130000_universal_acquisition_incentive`, at this fixed id so a
 * redeploy cannot create a second one. Two would stack into 40% off.
 */
export const UNIVERSAL_ACQUISITION_INCENTIVE_ID = '00000000-0000-4000-8000-00000000200a';

/**
 * The hard ceiling, founder ruling 2026-09-12: never more than three
 * discounted rides, concurrent requests included.
 *
 * Kept beside the id rather than read from `rules.maxPriorCompletedRides`
 * deliberately. That rule is the *eligibility window* — "the first three
 * completed rides ever", which a customer consumes by riding whether or not
 * they take the discount. This is the *grant cap*, enforced under a row lock at
 * ride creation. They agree at three today, and they answer different
 * questions: one is when the benefit applies, the other is how many times it
 * may ever be given.
 */
export const UNIVERSAL_ACQUISITION_INCENTIVE_MAX_RIDES = 3;
