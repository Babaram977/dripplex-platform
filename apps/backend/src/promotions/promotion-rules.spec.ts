import { RideType } from '@prisma/client';

import { evaluatePromotionRules, type PromotionEligibilityContext } from './promotion-rules';

function context(
  overrides: Partial<PromotionEligibilityContext> = {},
): PromotionEligibilityContext {
  return { userId: 'user-1', ...overrides };
}

describe('evaluatePromotionRules', () => {
  it('is eligible when no rules are set', () => {
    expect(evaluatePromotionRules(null, context())).toEqual({ eligible: true });
    expect(evaluatePromotionRules(undefined, context())).toEqual({ eligible: true });
  });

  it('is eligible when rules are set but empty', () => {
    expect(evaluatePromotionRules({}, context())).toEqual({ eligible: true });
  });

  describe('geo rules', () => {
    it('accepts a matching city case-insensitively', () => {
      const result = evaluatePromotionRules(
        { eligibleCities: ['Lagos', 'Abuja'] },
        context({ city: 'lagos' }),
      );
      expect(result.eligible).toBe(true);
    });

    it('rejects a non-matching city', () => {
      const result = evaluatePromotionRules(
        { eligibleCities: ['Lagos'] },
        context({ city: 'Kano' }),
      );
      expect(result.eligible).toBe(false);
    });

    it('fails closed when the city constraint exists but context has none', () => {
      const result = evaluatePromotionRules({ eligibleCities: ['Lagos'] }, context());
      expect(result.eligible).toBe(false);
    });
  });

  describe('ride type rules', () => {
    it('accepts a matching ride type', () => {
      const result = evaluatePromotionRules(
        { rideTypes: [RideType.ECONOMY] },
        context({ rideType: RideType.ECONOMY }),
      );
      expect(result.eligible).toBe(true);
    });

    it('rejects a non-matching ride type', () => {
      const result = evaluatePromotionRules(
        { rideTypes: [RideType.TRICYCLE] },
        context({ rideType: RideType.ECONOMY }),
      );
      expect(result.eligible).toBe(false);
    });
  });

  describe('user targeting', () => {
    it('enforces a whitelist', () => {
      const rules = { whitelistUserIds: ['user-2'] };
      expect(evaluatePromotionRules(rules, context({ userId: 'user-1' })).eligible).toBe(false);
      expect(evaluatePromotionRules(rules, context({ userId: 'user-2' })).eligible).toBe(true);
    });

    it('enforces a blacklist even without a whitelist', () => {
      const result = evaluatePromotionRules(
        { blacklistUserIds: ['user-1'] },
        context({ userId: 'user-1' }),
      );
      expect(result.eligible).toBe(false);
    });

    it('enforces newUsersOnly', () => {
      const rules = { newUsersOnly: true };
      expect(evaluatePromotionRules(rules, context({ isNewUser: true })).eligible).toBe(true);
      expect(evaluatePromotionRules(rules, context({ isNewUser: false })).eligible).toBe(false);
      expect(evaluatePromotionRules(rules, context()).eligible).toBe(false);
    });

    it('enforces returningUsersOnly', () => {
      const rules = { returningUsersOnly: true };
      expect(evaluatePromotionRules(rules, context({ isNewUser: false })).eligible).toBe(true);
      expect(evaluatePromotionRules(rules, context({ isNewUser: true })).eligible).toBe(false);
    });

    it('enforces referralOnly and inviteOnly', () => {
      expect(
        evaluatePromotionRules({ referralOnly: true }, context({ isReferral: true })).eligible,
      ).toBe(true);
      expect(evaluatePromotionRules({ referralOnly: true }, context()).eligible).toBe(false);
      expect(
        evaluatePromotionRules({ inviteOnly: true }, context({ isInvited: true })).eligible,
      ).toBe(true);
      expect(evaluatePromotionRules({ inviteOnly: true }, context()).eligible).toBe(false);
    });
  });

  describe('time rules', () => {
    it('enforces a weekday window', () => {
      const sunday = new Date('2026-08-02T12:00:00Z'); // Sunday
      const monday = new Date('2026-08-03T12:00:00Z'); // Monday
      const rules = { weekdays: [0, 6] };
      expect(evaluatePromotionRules(rules, context({ now: sunday })).eligible).toBe(true);
      expect(evaluatePromotionRules(rules, context({ now: monday })).eligible).toBe(false);
    });

    it('enforces a same-day time-of-day window', () => {
      const rules = { startHour: 9, endHour: 17 };
      const inWindow = new Date('2026-08-03T12:00:00');
      const outOfWindow = new Date('2026-08-03T20:00:00');
      expect(evaluatePromotionRules(rules, context({ now: inWindow })).eligible).toBe(true);
      expect(evaluatePromotionRules(rules, context({ now: outOfWindow })).eligible).toBe(false);
    });

    it('handles a time window that wraps past midnight', () => {
      const rules = { startHour: 22, endHour: 2 };
      const lateNight = new Date('2026-08-03T23:00:00');
      const earlyMorning = new Date('2026-08-03T01:00:00');
      const midday = new Date('2026-08-03T12:00:00');
      expect(evaluatePromotionRules(rules, context({ now: lateNight })).eligible).toBe(true);
      expect(evaluatePromotionRules(rules, context({ now: earlyMorning })).eligible).toBe(true);
      expect(evaluatePromotionRules(rules, context({ now: midday })).eligible).toBe(false);
    });
  });

  it('checks payment method and merchant category eligibility', () => {
    expect(
      evaluatePromotionRules({ paymentMethods: ['WALLET'] }, context({ paymentMethod: 'WALLET' }))
        .eligible,
    ).toBe(true);
    expect(
      evaluatePromotionRules({ paymentMethods: ['WALLET'] }, context({ paymentMethod: 'CASH' }))
        .eligible,
    ).toBe(false);
    expect(
      evaluatePromotionRules(
        { merchantCategories: ['restaurant'] },
        context({ merchantCategory: 'Restaurant' }),
      ).eligible,
    ).toBe(true);
  });
});
