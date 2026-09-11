import { randomUUID } from 'node:crypto';

import { PrismaClient, WalletOwnerType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { WalletService } from '../wallet/wallet.service';

import { LoyaltySettingsService } from './loyalty-settings.service';
import { LoyaltyStoreRedemptionService } from './loyalty-store-redemption.service';
import { LoyaltyService } from './loyalty.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { NotificationCenterService } from '../notification-center/notification-center.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PromotionsService } from '../promotions/promotions.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * Spending DX points at a merchant's counter, against a real database.
 *
 * Every test here is about the authorisation model rather than the arithmetic:
 * a merchant must not be able to take points they were not given a code for,
 * take the same code twice, take an expired one, or take one the holder has
 * since revoked. Those are the ways this feature could cost somebody their
 * balance, and none of them can be checked against a mock.
 */
describe('Loyalty store redemption (database)', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let loyalty: LoyaltyService;
  let redemptions: LoyaltyStoreRedemptionService;
  let holderId: string;
  let merchantId: string;
  let send: jest.Mock;
  let promotions: { redeemForReference: jest.Mock };
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
    const walletService = new WalletService(prisma, auditService, new DomainEventBus());
    send = jest.fn().mockResolvedValue({ skipped: false });
    const loyaltySettings = new LoyaltySettingsService(prisma, auditService);
    loyalty = new LoyaltyService(prisma, auditService, walletService, loyaltySettings);
    promotions = {
      redeemForReference: jest.fn(),
    };
    redemptions = new LoyaltyStoreRedemptionService(
      prisma,
      auditService,
      walletService,
      { send } as unknown as NotificationCenterService,
      promotions as unknown as PromotionsService,
      loyaltySettings,
    );

    holderId = await createUser('holder');
    merchantId = await createUser('merchant');
  });

  async function createUser(label: string): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `store-redemption-${label}-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: label === 'merchant' ? 'Merchant' : 'Holder',
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.loyaltyRedemptionCode.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
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

  beforeEach(async () => {
    if (!databaseAvailable) return;
    jest.clearAllMocks();
    await prisma.walletLedgerEntry.deleteMany({
      where: { referenceType: 'LOYALTY_STORE_COUPON', wallet: { ownerId: merchantId } },
    });
    await prisma.loyaltyRedemptionCode.deleteMany({ where: { userId: holderId } });
    await prisma.loyaltyLedgerEntry.deleteMany({ where: { account: { userId: holderId } } });
    await prisma.loyaltyAccount.deleteMany({ where: { userId: holderId } });
    await loyalty.awardPoints({ userId: holderId, points: 10_000, reason: 'Seeded' });
  });

  it('moves points to the merchant and naira with them', async () => {
    if (!databaseAvailable) return;

    const issued = await redemptions.issueCode(holderId, { points: 4_000 });
    expect(issued.amount).toBe(20);

    const result = await redemptions.redeem(merchantId, issued.code);

    expect(result.amount).toBe(20);
    expect(result.points).toBe(4_000);

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: holderId } });
    expect(account.pointsBalance).toBe(6_000);

    const wallet = await prisma.wallet.findFirstOrThrow({
      where: { ownerType: WalletOwnerType.MERCHANT, ownerId: merchantId },
    });
    expect(Number(wallet.availableBalance)).toBeGreaterThanOrEqual(20);

    // The holder is told somebody spent their balance.
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ userId: holderId }));
  });

  it('never stores the code it hands out', async () => {
    if (!databaseAvailable) return;

    const issued = await redemptions.issueCode(holderId, { points: 200 });
    const stored = await prisma.loyaltyRedemptionCode.findFirstOrThrow({
      where: { userId: holderId, redeemedAt: null },
    });

    // A database dump must not be a wallet full of live authorisations.
    expect(stored.codeHash).not.toContain(issued.code);
    expect(JSON.stringify(stored)).not.toContain(issued.code);
  });

  it('refuses a code that was never issued', async () => {
    if (!databaseAvailable) return;

    await expect(redemptions.redeem(merchantId, 'ZZZZZZZZ')).rejects.toThrow(
      'not valid or has expired',
    );
  });

  it('refuses the same code twice', async () => {
    if (!databaseAvailable) return;

    const issued = await redemptions.issueCode(holderId, { points: 400 });
    await redemptions.redeem(merchantId, issued.code);

    await expect(redemptions.redeem(merchantId, issued.code)).rejects.toThrow(
      'not valid or has expired',
    );

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: holderId } });
    expect(account.pointsBalance).toBe(9_600);
  });

  it('refuses an expired code', async () => {
    if (!databaseAvailable) return;

    const issued = await redemptions.issueCode(holderId, { points: 400 });
    await prisma.loyaltyRedemptionCode.updateMany({
      where: { userId: holderId, redeemedAt: null },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await expect(redemptions.redeem(merchantId, issued.code)).rejects.toThrow(
      'not valid or has expired',
    );
  });

  it('refuses a code the holder has revoked', async () => {
    if (!databaseAvailable) return;

    const issued = await redemptions.issueCode(holderId, { points: 400 });
    await expect(redemptions.cancelOutstanding(holderId)).resolves.toEqual({ cancelled: 1 });

    await expect(redemptions.redeem(merchantId, issued.code)).rejects.toThrow(
      'not valid or has expired',
    );
  });

  it('issuing a new code kills the previous one', async () => {
    if (!databaseAvailable) return;

    // Otherwise a holder could hand two codes drawn on the same balance to two
    // merchants, and only one of them would get paid.
    const first = await redemptions.issueCode(holderId, { points: 400 });
    const second = await redemptions.issueCode(holderId, { points: 600 });

    await expect(redemptions.redeem(merchantId, first.code)).rejects.toThrow(
      'not valid or has expired',
    );
    await expect(redemptions.redeem(merchantId, second.code)).resolves.toMatchObject({
      points: 600,
    });
  });

  it('refuses to issue a code for more points than the holder has', async () => {
    if (!databaseAvailable) return;

    await expect(redemptions.issueCode(holderId, { points: 20_000 })).rejects.toThrow(
      'Insufficient loyalty points',
    );
  });

  it('refuses at the counter if the balance no longer covers the code', async () => {
    if (!databaseAvailable) return;

    const issued = await redemptions.issueCode(holderId, { points: 10_000 });
    // The holder spent it to their own wallet on the way to the shop.
    await loyalty.redeemPoints(holderId, 10_000);

    await expect(redemptions.redeem(merchantId, issued.code)).rejects.toThrow('no longer covered');

    // And the refusal leaves the code usable again rather than burning it, so
    // the holder can top up and present it, or generate a smaller one.
    const stored = await prisma.loyaltyRedemptionCode.findFirstOrThrow({
      where: { userId: holderId },
      orderBy: { createdAt: 'desc' },
    });
    expect(stored.redeemedAt).toBeNull();
  });

  it('refuses points that are not whole naira', async () => {
    if (!databaseAvailable) return;

    await expect(redemptions.issueCode(holderId, { points: 250 })).rejects.toThrow(
      'multiples of 200',
    );
  });

  it('funds an in-store coupon and pays the merchant for the discount', async () => {
    if (!databaseAvailable) return;

    // Founder decision: DrippleX funds the discount and settles the merchant
    // the same way it settles points — so giving money off at the till costs
    // the merchant nothing.
    promotions.redeemForReference.mockResolvedValue({
      redemption: { id: 'promo-redemption-1' },
      discountAmount: 750,
      creditAmount: 0,
      promotion: { id: 'promo-1' },
    });

    const issued = await redemptions.issueCode(holderId, { couponCode: 'SAVE750' });
    expect(issued.points).toBe(0);
    expect(issued.couponCode).toBe('SAVE750');

    const result = await redemptions.redeem(merchantId, issued.code, { billAmount: 5_000 });

    expect(result.couponDiscount).toBe(750);
    expect(result.totalCredited).toBe(750);
    // The coupon is redeemed as the holder's, not the merchant's — per-user
    // limits are the whole reason it rides on their code.
    expect(promotions.redeemForReference).toHaveBeenCalledWith(
      expect.objectContaining({ userId: holderId, subtotal: 5_000, couponCode: 'SAVE750' }),
      expect.anything(),
    );

    const credit = await prisma.walletLedgerEntry.findFirstOrThrow({
      where: { referenceType: 'LOYALTY_STORE_COUPON', wallet: { ownerId: merchantId } },
    });
    expect(Number(credit.amount)).toBe(750);
  });

  it('spends points and a coupon on one code, in one visit', async () => {
    if (!databaseAvailable) return;

    promotions.redeemForReference.mockResolvedValue({
      redemption: { id: 'promo-redemption-2' },
      discountAmount: 200,
      creditAmount: 0,
      promotion: { id: 'promo-2' },
    });

    const issued = await redemptions.issueCode(holderId, { points: 2_000, couponCode: 'BOTH' });
    const result = await redemptions.redeem(merchantId, issued.code, { billAmount: 3_000 });

    // ₦10 of points plus a ₦200 discount DrippleX is covering.
    expect(result.amount).toBe(10);
    expect(result.couponDiscount).toBe(200);
    expect(result.totalCredited).toBe(210);
  });

  it('refuses a coupon code without a bill to take it off', async () => {
    if (!databaseAvailable) return;

    const issued = await redemptions.issueCode(holderId, { couponCode: 'NEEDSBILL' });

    // A percentage coupon has no meaning without a total, and guessing one
    // would either short the merchant or overpay them.
    await expect(redemptions.redeem(merchantId, issued.code)).rejects.toThrow('bill total');
    expect(promotions.redeemForReference).not.toHaveBeenCalled();
  });

  it('refuses a wallet-credit coupon at a counter', async () => {
    if (!databaseAvailable) return;

    // Those put money in the customer's wallet, which is not money off a bill
    // — crediting the merchant for it would pay them for a saving the customer
    // never made at the till.
    promotions.redeemForReference.mockResolvedValue({
      redemption: { id: 'promo-redemption-3' },
      discountAmount: 0,
      creditAmount: 500,
      promotion: { id: 'promo-3' },
    });

    const issued = await redemptions.issueCode(holderId, { couponCode: 'WALLETONLY' });

    await expect(
      redemptions.redeem(merchantId, issued.code, { billAmount: 4_000 }),
    ).rejects.toThrow('cannot be used at a counter');
  });

  it('refuses a code carrying neither points nor a coupon', async () => {
    if (!databaseAvailable) return;

    await expect(redemptions.issueCode(holderId, {})).rejects.toThrow(
      'points to spend, a coupon, or both',
    );
  });

  it('links the points that left to the naira that arrived', async () => {
    if (!databaseAvailable) return;

    const issued = await redemptions.issueCode(holderId, { points: 2_000 });
    await redemptions.redeem(merchantId, issued.code);

    const code = await prisma.loyaltyRedemptionCode.findFirstOrThrow({
      where: { userId: holderId, redeemedAt: { not: null } },
    });
    expect(code.redeemedBy).toBe(merchantId);

    const debit = await prisma.loyaltyLedgerEntry.findUniqueOrThrow({
      where: { id: code.ledgerEntryId ?? '' },
    });
    expect(debit.points).toBe(-2_000);

    const credit = await prisma.walletLedgerEntry.findFirstOrThrow({
      where: { referenceType: 'LOYALTY_STORE_REDEMPTION', referenceId: debit.id },
    });
    expect(Number(credit.amount)).toBe(10);
  });
});
