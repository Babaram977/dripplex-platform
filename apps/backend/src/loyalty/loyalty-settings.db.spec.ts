import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { WalletService } from '../wallet/wallet.service';

import { LoyaltySettingsService } from './loyalty-settings.service';
import { LOYALTY_SETTING_ID } from './loyalty.constants';
import { LoyaltyService } from './loyalty.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-LOYALTY-005 — the cash-out, as shipped but controllable.
 *
 * Founder decision, 2026-09-11: "let it be as shipped but can be controlled."
 * So the first thing these tests assert is that nothing changed, and the rest
 * assert that each control actually controls something.
 */
describe('loyalty settings', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let settings: LoyaltySettingsService;
  let loyalty: LoyaltyService;
  let walletService: WalletService;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    walletService = new WalletService(prisma, auditService, new DomainEventBus());
    settings = new LoyaltySettingsService(prisma, auditService);
    loyalty = new LoyaltyService(prisma, auditService, walletService, settings);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.loyaltyLedgerEntry.deleteMany({
        where: { account: { userId: { in: createdUserIds } } },
      });
      await prisma.loyaltyAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.walletLedgerEntry.deleteMany({
        where: { wallet: { ownerId: { in: createdUserIds } } },
      });
      await prisma.wallet.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    // Back to what shipped, so one test's setting never becomes another's
    // surprise — or another suite's.
    await prisma.loyaltySetting.update({
      where: { id: LOYALTY_SETTING_ID },
      data: {
        pointsPerNaira: 100,
        walletRedemptionEnabled: true,
        storeRedemptionEnabled: true,
        minRedemptionPoints: 100,
        dailyRedemptionPointsCap: null,
      },
    });
  });

  async function holderWith(points: number): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `loyalty-settings-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Holder',
      },
    });
    createdUserIds.push(user.id);
    await prisma.loyaltyAccount.create({
      data: { userId: user.id, pointsBalance: points, lifetimePoints: points },
    });
    return user.id;
  }

  it('holds the canonical valuation the founder ruled, not the one it shipped with', async () => {
    if (!databaseAvailable) return;
    // Founder ruling 2026-09-12: 100 points = NGN 1, superseding the 200 that
    // DPX-LOYALTY-005 shipped the day before. This asserts the migrated row,
    // not a default, because changing a column default does nothing to a row
    // that already exists — which is exactly how a re-pricing gets missed.
    //
    // `minRedemptionPoints` moved with it deliberately. It means "one naira's
    // worth", and 200 is a whole multiple of 100, so leaving it would have
    // passed every validator while doubling the smallest cash-out to NGN 2.
    const current = await settings.get();
    expect(current).toMatchObject({
      pointsPerNaira: 100,
      walletRedemptionEnabled: true,
      storeRedemptionEnabled: true,
      minRedemptionPoints: 100,
      dailyRedemptionPointsCap: null,
    });
  });

  it('redeems 100 points for ₦1 of wallet credit at the ruled rate', async () => {
    if (!databaseAvailable) return;
    // The same 2,000 points that paid ₦10 under the superseded 200 now pay ₦20.
    // That doubling is the ruling, not a defect.
    const userId = await holderWith(2000);

    await loyalty.redeemPoints(userId, 2000);

    const wallet = await walletService.getWallet('CUSTOMER', userId);
    expect(wallet.availableBalance).toBeCloseTo(20);
  });

  it('closes the cash-out without touching the balance, when Operations says so', async () => {
    if (!databaseAvailable) return;
    // This is Nora's §7 answered by a switch rather than by deleting a feature:
    // the points are still there and still spendable, the cash door is shut.
    const userId = await holderWith(2000);
    await settings.update({ walletRedemptionEnabled: false }, userId);

    await expect(loyalty.redeemPoints(userId, 2000)).rejects.toThrow(/cannot be cashed out/i);

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    expect(account.pointsBalance).toBe(2000);
    const wallet = await walletService.getWallet('CUSTOMER', userId);
    expect(wallet.availableBalance).toBe(0);
  });

  it('tells a customer the cash-out is closed rather than letting them try', async () => {
    if (!databaseAvailable) return;
    // A screen offering a button that will be refused is worse than one that
    // does not offer it.
    const userId = await holderWith(2000);
    await settings.update({ walletRedemptionEnabled: false }, userId);

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    const summary = await loyalty.getPointsSummary(account);
    expect(summary.walletRedemptionEnabled).toBe(false);
  });

  it('re-prices points when Operations changes the rate', async () => {
    if (!databaseAvailable) return;
    // Deliberately 50, not 100. This test used to set 100 against a stored 200;
    // once the founder's ruling made 100 the stored rate, setting 100 here would
    // have asserted nothing at all while still passing — a test that proves the
    // re-pricing path works only because the number it writes differs from the
    // one already there. 50 makes the same 2,000 points worth ₦40.
    const userId = await holderWith(2000);
    await settings.update({ pointsPerNaira: 50, minRedemptionPoints: 50 }, userId);

    await loyalty.redeemPoints(userId, 2000);

    const wallet = await walletService.getWallet('CUSTOMER', userId);
    expect(wallet.availableBalance).toBeCloseTo(40);
  });

  it('enforces a rolling daily cap across separate redemptions', async () => {
    if (!databaseAvailable) return;
    // The setting between "points are cash" and "points are not cash at all".
    const userId = await holderWith(5000);
    await settings.update({ dailyRedemptionPointsCap: 1000 }, userId);

    await loyalty.redeemPoints(userId, 600);
    await expect(loyalty.redeemPoints(userId, 600)).rejects.toThrow(/daily redemption limit/i);
    // What is left of the cap is still redeemable, so the limit is a ceiling
    // rather than a door that slams on the first refusal.
    await loyalty.redeemPoints(userId, 400);

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    expect(account.pointsBalance).toBe(4000);
  });

  it('refuses a minimum that no redemption could ever satisfy', async () => {
    if (!databaseAvailable) return;
    // A minimum that is not a whole number of naira would refuse everything:
    // the redeem path requires multiples of the conversion rate, so no amount
    // could satisfy both rules at once.
    const userId = await holderWith(0);
    await expect(settings.update({ minRedemptionPoints: 250 }, userId)).rejects.toThrow(
      /whole number of naira/i,
    );
  });

  it('checks the minimum against the rate being set, not only the one stored', async () => {
    if (!databaseAvailable) return;
    // Raising the rate past the stored minimum breaks the same rule from the
    // other side, so an operator changing both at once must be able to — and
    // an operator changing only one must be stopped.
    const userId = await holderWith(0);
    await expect(settings.update({ pointsPerNaira: 1000 }, userId)).rejects.toThrow(
      /whole number of naira/i,
    );
    await expect(
      settings.update({ pointsPerNaira: 1000, minRedemptionPoints: 1000 }, userId),
    ).resolves.toMatchObject({ pointsPerNaira: 1000, minRedemptionPoints: 1000 });
  });

  it('refuses a conversion rate that is not a positive whole number', async () => {
    if (!databaseAvailable) return;
    const userId = await holderWith(0);
    await expect(settings.update({ pointsPerNaira: 0 }, userId)).rejects.toThrow(/at least 1/i);
    await expect(settings.update({ pointsPerNaira: 12.5 }, userId)).rejects.toThrow(
      /whole number/i,
    );
  });

  it('never rewrites what an earlier redemption was worth', async () => {
    if (!databaseAvailable) return;
    // Re-pricing points is a forward-looking decision. A redemption already
    // made is money already moved.
    const userId = await holderWith(2000);
    await loyalty.redeemPoints(userId, 2000);
    const before = await walletService.getWallet('CUSTOMER', userId);

    await settings.update({ pointsPerNaira: 50 }, userId);

    const after = await walletService.getWallet('CUSTOMER', userId);
    expect(after.availableBalance).toBe(before.availableBalance);
  });
});
