import { SupportCategory } from '@prisma/client';

import { MANDATORY_HUMAN_CATEGORIES, requiresHumanHandling } from './support.constants';

/**
 * DPX-SUPPORT-001, founder decision 2026-09-11: money and safety are never
 * answered by automation.
 *
 * Nothing reads `requiresHumanHandling` in Phase 1, because no automation
 * exists yet. That is exactly why it is pinned by a test now — a rule with no
 * current caller is a rule nothing else would notice breaking, and the moment
 * it acquires one is the moment it is load-bearing.
 */
describe('requiresHumanHandling', () => {
  it.each([SupportCategory.PAYMENT, SupportCategory.WALLET, SupportCategory.SAFETY])(
    'always routes %s to a person',
    (category) => {
      expect(requiresHumanHandling(category)).toBe(true);
    },
  );

  it.each([
    SupportCategory.RIDE,
    SupportCategory.FOOD_ORDER,
    SupportCategory.MERCHANT,
    SupportCategory.DRIVER_RIDER,
    SupportCategory.ACCOUNT,
    SupportCategory.TECHNICAL,
    SupportCategory.OTHER,
  ])('leaves %s open to first-line handling', (category) => {
    expect(requiresHumanHandling(category)).toBe(false);
  });

  it('covers every category in the locked enum, so a new one cannot be undecided', () => {
    // Adding a category is a routing question, not a new label. If this fails,
    // the new value needs a decision about whether it is money or safety —
    // recorded in MANDATORY_HUMAN_CATEGORIES or deliberately left out.
    const decided = Object.values(SupportCategory).map((category) => ({
      category,
      human: requiresHumanHandling(category),
    }));
    expect(decided).toHaveLength(10);
    expect(
      decided
        .filter((entry) => entry.human)
        .map((entry) => entry.category)
        .sort(),
    ).toEqual(['PAYMENT', 'SAFETY', 'WALLET']);
    expect(MANDATORY_HUMAN_CATEGORIES.size).toBe(3);
  });
});
