import { nairaToPoints, resolvePromoterReward } from './campaign-reward';

/**
 * DPX-PROMO-REF-001 — the founder's locked economics, asserted as arithmetic.
 *
 * These are the numbers somebody was recruited on. They get a unit spec of
 * their own so a change to them is a change to a test that names them, rather
 * than a number quietly drifting inside a service.
 */
describe('campaign reward economics', () => {
  const PROGRAMME_REFERRER_NGN = 150;
  const RATE = 100; // founder ruling 2026-09-12: 100 DX Points = ₦1

  describe('the locked cash rates', () => {
    it.each([
      ['Customer referrer', 150],
      ['Driver', 200],
      ['Pioneer driver', 350],
    ])('%s earns ₦%i per qualified acquisition', (_label, ngn) => {
      const resolved = resolvePromoterReward(
        { rewardAmount: ngn, rewardPoints: null },
        PROGRAMME_REFERRER_NGN,
        RATE,
      );
      expect(resolved.referrerRewardAmount).toBe(ngn);
      expect(resolved.referrerRewardPoints).toBeNull();
      // A cash reward snapshots no rate: there is no conversion to preserve.
      expect(resolved.pointsPerNairaAtGrant).toBeNull();
    });
  });

  describe('the points alternative at 100 per naira', () => {
    it.each([
      [150, 15_000],
      [200, 20_000],
      [350, 35_000],
    ])('₦%i is %i DX Points', (ngn, points) => {
      expect(nairaToPoints(ngn, RATE)).toBe(points);
    });

    it('snapshots the rate that priced it, because that rate has already moved', () => {
      const resolved = resolvePromoterReward(
        { rewardAmount: null, rewardPoints: 35_000 },
        PROGRAMME_REFERRER_NGN,
        RATE,
      );
      expect(resolved.referrerRewardPoints).toBe(35_000);
      expect(resolved.referrerRewardAmount).toBeNull();
      expect(resolved.pointsPerNairaAtGrant).toBe(100);
    });

    it('refuses a rate that would strand a fraction of a point', () => {
      // Rounding a fraction away is somebody's money, so the honest failure is
      // to refuse rather than to floor it.
      expect(() => nairaToPoints(150.5, 1)).toThrow(/whole number of DX Points/i);
      expect(() => nairaToPoints(150, 0)).toThrow(/whole number above zero/i);
    });
  });

  it('falls back to the platform programme when no campaign is behind the referral', () => {
    // The ordinary self-serve referral, unchanged from before this feature.
    const resolved = resolvePromoterReward(null, PROGRAMME_REFERRER_NGN, RATE);
    expect(resolved.referrerRewardAmount).toBe(150);
    expect(resolved.referrerRewardPoints).toBeNull();
  });

  it('lets a campaign override the standing programme rate', () => {
    // A pioneer driver recruited on ₦350 earns ₦350 even though the programme
    // says ₦150. The campaign is what they were told.
    const resolved = resolvePromoterReward(
      { rewardAmount: 350, rewardPoints: null },
      PROGRAMME_REFERRER_NGN,
      RATE,
    );
    expect(resolved.referrerRewardAmount).toBe(350);
  });

  it('refuses a promoter row carrying both or neither reward', () => {
    // Unreachable for a stored row — the database CHECK forbids it — but read
    // wrongly this is money, and a silent `?? 0` would pay nothing in silence.
    expect(() =>
      resolvePromoterReward(
        { rewardAmount: 150, rewardPoints: 15_000 },
        PROGRAMME_REFERRER_NGN,
        RATE,
      ),
    ).toThrow(/exactly one/i);
    expect(() =>
      resolvePromoterReward(
        { rewardAmount: null, rewardPoints: null },
        PROGRAMME_REFERRER_NGN,
        RATE,
      ),
    ).toThrow(/exactly one/i);
  });

  it('reads a Prisma Decimal as faithfully as a number', () => {
    const decimalLike = { toString: () => '350' };
    expect(
      resolvePromoterReward({ rewardAmount: decimalLike, rewardPoints: null }, 150, RATE)
        .referrerRewardAmount,
    ).toBe(350);
  });
});
