import { CommissionCampaignStatus, CommissionScope } from '@prisma/client';

import { CommissionRateResolverService } from './commission-rate-resolver.service';

import type { PrismaService } from '../prisma/prisma.service';

/**
 * What a partner is charged. Every case here is about the resolver either
 * applying a rate Ops genuinely set, or falling back to the standing rate that
 * both sides already agreed to — never inventing a third number.
 */
describe('CommissionRateResolverService', () => {
  const now = new Date('2026-09-12T14:00:00.000Z'); // a Saturday
  let findMany: jest.Mock;
  let service: CommissionRateResolverService;

  function campaign(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Launch week',
      scope: CommissionScope.MERCHANT_ORDER,
      commissionRate: 0.07,
      status: CommissionCampaignStatus.ACTIVE,
      priority: 0,
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endsAt: new Date('2026-09-30T00:00:00.000Z'),
      rules: null,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    service = new CommissionRateResolverService({
      commissionCampaign: { findMany },
    } as unknown as PrismaService);
  });

  it('charges the standing rate when no campaign is running', async () => {
    await expect(service.resolve(CommissionScope.MERCHANT_ORDER, 0.1, { now })).resolves.toEqual({
      rate: 0.1,
      campaignId: null,
      campaignName: null,
    });
  });

  it('charges the campaign rate when one is in force', async () => {
    findMany.mockResolvedValue([campaign()]);

    const result = await service.resolve(CommissionScope.MERCHANT_ORDER, 0.1, { now });

    expect(result.rate).toBe(0.07);
    expect(result.campaignId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('only ever looks at campaigns for the scope being settled, in force now', async () => {
    await service.resolve(CommissionScope.RIDE, 0.1, { now });

    // Correctness does not depend on the sweep having marked anything expired:
    // the window is part of the query.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scope: CommissionScope.RIDE,
          status: CommissionCampaignStatus.ACTIVE,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
      }),
    );
  });

  it('applies a weekend-only campaign on a Saturday', async () => {
    findMany.mockResolvedValue([campaign({ rules: { weekdays: [0, 6] } })]);

    await expect(
      service.resolve(CommissionScope.MERCHANT_ORDER, 0.1, { now }),
    ).resolves.toMatchObject({ rate: 0.07 });
  });

  it('does not apply a weekend-only campaign on a Wednesday', async () => {
    findMany.mockResolvedValue([campaign({ rules: { weekdays: [0, 6] } })]);

    await expect(
      service.resolve(CommissionScope.MERCHANT_ORDER, 0.1, {
        now: new Date('2026-09-09T14:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ rate: 0.1, campaignId: null });
  });

  it('takes the first match, which the query has already ranked by priority', async () => {
    findMany.mockResolvedValue([
      campaign({ id: '22222222-2222-4222-8222-222222222222', commissionRate: 0.05, priority: 10 }),
      campaign({ commissionRate: 0.07, priority: 0 }),
    ]);

    const result = await service.resolve(CommissionScope.MERCHANT_ORDER, 0.1, { now });

    expect(result.rate).toBe(0.05);
  });

  it('falls through to a lower-priority campaign when the top one does not match', async () => {
    findMany.mockResolvedValue([
      campaign({
        id: '22222222-2222-4222-8222-222222222222',
        commissionRate: 0.05,
        priority: 10,
        rules: { weekdays: [1] },
      }),
      campaign({ commissionRate: 0.07 }),
    ]);

    await expect(
      service.resolve(CommissionScope.MERCHANT_ORDER, 0.1, { now }),
    ).resolves.toMatchObject({ rate: 0.07 });
  });

  it('falls back to the standing rate when a rule needs something the caller cannot supply', async () => {
    // Fail closed. The standing rate is the one both sides agreed to, so
    // falling back to it is never a surprise in either direction.
    findMany.mockResolvedValue([campaign({ rules: { eligibleCities: ['Kano'] } })]);

    await expect(
      service.resolve(CommissionScope.MERCHANT_ORDER, 0.1, { now }),
    ).resolves.toMatchObject({ rate: 0.1, campaignId: null });
  });

  it('applies a city-scoped campaign when the caller does supply the city', async () => {
    findMany.mockResolvedValue([campaign({ rules: { eligibleCities: ['Kano'] } })]);

    await expect(
      service.resolve(CommissionScope.MERCHANT_ORDER, 0.1, { city: 'Kano', now }),
    ).resolves.toMatchObject({ rate: 0.07 });
  });

  it('does not apply a campaign aimed at named partners to an unattributed transaction', async () => {
    findMany.mockResolvedValue([
      campaign({ rules: { whitelistUserIds: ['33333333-3333-4333-8333-333333333333'] } }),
    ]);

    await expect(
      service.resolve(CommissionScope.MERCHANT_ORDER, 0.1, { now }),
    ).resolves.toMatchObject({ rate: 0.1, campaignId: null });
  });

  it.each([1, 1.5, -0.1, Number.NaN])(
    'refuses a stored rate of %p and charges the standing rate',
    async (rate) => {
      // A rate at or above 1 takes everything the partner earned, or more. A
      // figure that cannot be right is not one to settle money against.
      findMany.mockResolvedValue([campaign({ commissionRate: rate })]);

      await expect(
        service.resolve(CommissionScope.MERCHANT_ORDER, 0.1, { now }),
      ).resolves.toMatchObject({ rate: 0.1, campaignId: null });
    },
  );

  it('allows a zero-commission campaign', async () => {
    // 0% is a real offer — a free week — and must not be mistaken for "unset".
    findMany.mockResolvedValue([campaign({ commissionRate: 0 })]);

    await expect(
      service.resolve(CommissionScope.MERCHANT_ORDER, 0.1, { now }),
    ).resolves.toMatchObject({ rate: 0 });
  });
});
