import { describe, expect, it } from 'vitest';

import { referralRewardQuote } from './referral-reward-quote.js';

/**
 * DPX-PROMO-REF-002 — one code, one rate.
 *
 * A promoter's referral code pays one thing at a time: the programme amount, or
 * the amount of the campaign they are enrolled on. This function is the single
 * place that decides which, so that the customer app and the merchant portal
 * cannot answer the question differently for the same promoter.
 */
describe('referralRewardQuote', () => {
  it('quotes naira when there is no points campaign', () => {
    expect(referralRewardQuote({ referrerRewardAmount: 150, campaignRewardPoints: null })).toEqual({
      kind: 'NGN',
      amountNgn: 150,
    });
  });

  it('quotes whatever naira figure the server returned, campaign or not', () => {
    // The campaign rate arrives in this same field — the caller cannot tell a
    // campaign amount from a programme one, and must not need to.
    expect(referralRewardQuote({ referrerRewardAmount: 350, campaignRewardPoints: null })).toEqual({
      kind: 'NGN',
      amountNgn: 350,
    });
  });

  it('quotes points when the campaign pays points', () => {
    expect(referralRewardQuote({ referrerRewardAmount: 350, campaignRewardPoints: 5000 })).toEqual({
      kind: 'POINTS',
      points: 5000,
    });
  });

  it('never returns a naira figure alongside points', () => {
    // The type already forbids it; this asserts the runtime value, because the
    // failure being guarded is a screen finding a naira number to print for a
    // points campaign and applying a conversion nobody authorised.
    const quote = referralRewardQuote({ referrerRewardAmount: 350, campaignRewardPoints: 5000 });
    expect(quote).not.toHaveProperty('amountNgn');
  });

  it('treats zero points as a points campaign, not as absent', () => {
    // Zero is a real configured value and null is "no campaign". Conflating them
    // would show a naira amount to somebody whose campaign pays nothing yet.
    expect(referralRewardQuote({ referrerRewardAmount: 350, campaignRewardPoints: 0 })).toEqual({
      kind: 'POINTS',
      points: 0,
    });
  });
});
