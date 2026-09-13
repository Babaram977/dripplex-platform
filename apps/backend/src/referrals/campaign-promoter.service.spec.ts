import { CampaignParticipantType, Prisma } from '@prisma/client';

import { CampaignPromoterService } from './campaign-promoter.service';

import type { ReferralsService } from './referrals.service';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * DPX-PROMO-REF-001 — the one behaviour the database spec cannot reach.
 *
 * `campaign_promoters` has two unique constraints and both raise P2002. A token
 * collision is a retryable accident; a `(promotion_id, user_id)` collision means
 * somebody else enrolled this person first. Conflating them retries a lost race
 * ten times and then reports a token-generation failure, sending whoever reads
 * the log to look at the generator instead of at the race.
 *
 * The concurrent test in `campaign-promoter.db.spec.ts` does not prove this:
 * the pre-read catches every loser before `create` is reached, so the P2002
 * branch never runs there and a mutation conflating the two survived the whole
 * suite. That is why this exists — the error has to be handed to the service
 * directly for the discrimination to be exercised at all.
 */
describe('CampaignPromoterService P2002 discrimination', () => {
  function p2002(target: string[]): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target },
    });
  }

  function build(createImpl: jest.Mock): {
    service: CampaignPromoterService;
    create: jest.Mock;
  } {
    const prisma = {
      promotion: { findFirst: jest.fn().mockResolvedValue({ id: 'promo-1', status: 'ACTIVE' }) },
      campaignPromoter: { findUnique: jest.fn().mockResolvedValue(null), create: createImpl },
    } as unknown as PrismaService;
    const referrals = {
      getOrCreateMyCode: jest.fn().mockResolvedValue({ id: 'ref-1' }),
    } as unknown as ReferralsService;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    return { service: new CampaignPromoterService(prisma, referrals, audit), create: createImpl };
  }

  const input = {
    promotionId: 'promo-1',
    userId: 'user-1',
    participantType: CampaignParticipantType.INFLUENCER,
    reward: { amountNgn: 150 },
  };

  it('does not retry a lost enrolment race, and says what actually happened', async () => {
    const create = jest.fn().mockRejectedValue(p2002(['promotion_id', 'user_id']));
    const { service } = build(create);

    await expect(service.addPromoter(input, 'admin-1')).rejects.toThrow(/already a promoter/i);
    // Once, not ten times. Retrying somebody else's win is ten pointless round
    // trips ending in a misleading message.
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('does retry a token collision, and succeeds on the next token', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(p2002(['token']))
      .mockRejectedValueOnce(p2002(['token']))
      .mockResolvedValue({ id: 'cp-1', token: 'TOK', promotionId: 'promo-1', userId: 'user-1' });
    const { service } = build(create);

    await expect(service.addPromoter(input, 'admin-1')).resolves.toMatchObject({ id: 'cp-1' });
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('gives up on a run of token collisions rather than looping for ever', async () => {
    const create = jest.fn().mockRejectedValue(p2002(['token']));
    const { service } = build(create);

    await expect(service.addPromoter(input, 'admin-1')).rejects.toThrow(/unique campaign token/i);
    expect(create).toHaveBeenCalledTimes(10);
  });

  it('rethrows anything that is not a unique violation', async () => {
    const create = jest.fn().mockRejectedValue(new Error('connection reset'));
    const { service } = build(create);

    await expect(service.addPromoter(input, 'admin-1')).rejects.toThrow(/connection reset/i);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
