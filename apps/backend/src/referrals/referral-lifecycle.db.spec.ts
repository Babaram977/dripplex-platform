import { randomUUID } from 'node:crypto';

import {
  BusinessType,
  BusinessVerificationStatus,
  FulfillmentType,
  OrderStatus,
  PrismaClient,
  ReferralOwnerType,
  ReferralRedemptionStatus,
  ReferralRefereeType,
  ReferralRejectionReason,
  RideStatus,
  RideType,
  WalletOwnerType,
} from '@prisma/client';

import { WalletService } from '../wallet/wallet.service';

import { ReferralAntiAbuseService } from './referral-anti-abuse.service';
import { ReferralLifecycleService } from './referral-lifecycle.service';
import { ReferralQualificationService } from './referral-qualification.service';
import { REFERRAL_WALLET_REFERENCE_TYPES } from './referral.constants';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-REFERRAL-003 — the lifecycle against a real database.
 *
 * The unit-testable parts of this feature are the normalisation helpers. Every
 * property that actually matters — the hold, the snapshot, the idempotent
 * payment, the conditional transitions — is a database property, and asserting
 * them against mocks would prove only that the mocks were written to agree.
 */
describe('ReferralLifecycleService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: ReferralLifecycleService;
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

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const eventBus = { emit: jest.fn().mockResolvedValue(undefined) } as unknown as DomainEventBus;
    walletService = new WalletService(prisma, auditService, eventBus);
    service = new ReferralLifecycleService(
      prisma,
      auditService,
      eventBus,
      walletService,
      new ReferralQualificationService(prisma),
      new ReferralAntiAbuseService(prisma),
      { awardPoints: () => Promise.resolve(undefined) } as never,
    );
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.referralRedemption.deleteMany({
        where: { refereeUserId: { in: createdUserIds } },
      });
      await prisma.referral.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.walletLedgerEntry.deleteMany({
        where: { wallet: { ownerId: { in: createdUserIds } } },
      });
      await prisma.wallet.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await prisma.ride.deleteMany({ where: { customerId: { in: createdUserIds } } });
      await prisma.order.deleteMany({ where: { customerId: { in: createdUserIds } } });
      await prisma.order.deleteMany({ where: { merchantId: { in: createdUserIds } } });
      await prisma.bankAccount.deleteMany({ where: { merchantId: { in: createdUserIds } } });
      await prisma.business.deleteMany({ where: { merchantId: { in: createdUserIds } } });
      await prisma.customerKyc.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.authSession.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function createUser(label: string, phone?: string): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `referral-lifecycle-${label}-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: label,
        ...(phone === undefined ? {} : { phone }),
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  /** A referrer with a code, and a referee who has redeemed it. */
  async function redeemedPair(options: { refereePhone?: string } = {}): Promise<{
    referrerId: string;
    refereeId: string;
    redemptionId: string;
  }> {
    const referrerId = await createUser('referrer');
    const refereeId = await createUser('referee', options.refereePhone);
    const referral = await prisma.referral.create({
      data: {
        userId: referrerId,
        ownerType: ReferralOwnerType.CUSTOMER,
        code: randomUUID().slice(0, 10).toUpperCase(),
      },
    });
    const redemption = await prisma.referralRedemption.create({
      data: {
        referralId: referral.id,
        refereeUserId: refereeId,
        refereeType: ReferralRefereeType.CUSTOMER,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    return { referrerId, refereeId, redemptionId: redemption.id };
  }

  /** The referee's first completed ride — the customer milestone. */
  async function completeARide(customerId: string): Promise<void> {
    await prisma.ride.create({
      data: {
        customerId,
        status: RideStatus.COMPLETED,
        rideType: RideType.ECONOMY,
        pickupAddress: 'Test pickup',
        pickupLatitude: 6.5,
        pickupLongitude: 3.3,
        dropoffAddress: 'Test dropoff',
        dropoffLatitude: 6.6,
        dropoffLongitude: 3.4,
      },
    });
  }

  async function completeAnOrder(customerId: string, merchantId: string): Promise<void> {
    await prisma.order.create({
      data: {
        customerId,
        merchantId,
        orderNumber: `REF-${randomUUID().slice(0, 12).toUpperCase()}`,
        status: OrderStatus.COMPLETED,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 1000,
        total: 1000,
      },
    });
  }

  async function createBusiness(
    merchantId: string,
    verificationStatus: BusinessVerificationStatus,
  ): Promise<{ id: string }> {
    return await prisma.business.create({
      data: {
        merchantId,
        businessName: 'Referred Shop',
        businessType: BusinessType.SOLE_PROPRIETORSHIP,
        registrationNumber: `RC-${randomUUID().slice(0, 12)}`,
        email: `shop-${randomUUID()}@dripplex.test`,
        phone: '+2348000000000',
        country: 'Nigeria',
        state: 'Lagos',
        city: 'Ikeja',
        address: '1 Test Street',
        latitude: 6.6,
        longitude: 3.3,
        verificationStatus,
      },
      select: { id: true },
    });
  }

  async function setHoldDays(
    days: number,
    refereeType: ReferralRefereeType = ReferralRefereeType.CUSTOMER,
  ): Promise<void> {
    await prisma.referralProgramme.update({ where: { refereeType }, data: { holdDays: days } });
  }

  afterEach(async () => {
    if (databaseAvailable) {
      await setHoldDays(7);
      await setHoldDays(7, ReferralRefereeType.MERCHANT);
    }
  });

  it('leaves a referral PENDING until the referee has actually transacted', async () => {
    if (!databaseAvailable) return;
    const { redemptionId } = await redeemedPair();

    expect(await service.advance(redemptionId)).toBe(ReferralRedemptionStatus.PENDING);
  });

  it('qualifies on the milestone but does not pay until the hold elapses', async () => {
    if (!databaseAvailable) return;
    // The whole reason the lifecycle exists: earned, and not yet payable.
    const { referrerId, refereeId, redemptionId } = await redeemedPair();
    await completeARide(refereeId);

    expect(await service.advance(redemptionId)).toBe(ReferralRedemptionStatus.QUALIFIED);

    const referrerWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, referrerId);
    expect(referrerWallet.availableBalance).toBe(0);
  });

  it('snapshots the amounts at qualification, so a later re-pricing cannot rewrite them', async () => {
    if (!databaseAvailable) return;
    const { redemptionId, refereeId } = await redeemedPair();
    await completeARide(refereeId);
    await service.advance(redemptionId);

    await prisma.referralProgramme.update({
      where: { refereeType: ReferralRefereeType.CUSTOMER },
      data: { referrerRewardAmount: 9999 },
    });

    const stored = await prisma.referralRedemption.findUniqueOrThrow({
      where: { id: redemptionId },
    });
    expect(Number(stored.referrerRewardAmount)).toBe(350);

    await prisma.referralProgramme.update({
      where: { refereeType: ReferralRefereeType.CUSTOMER },
      data: { referrerRewardAmount: 350 },
    });
  });

  it('pays both wallets once the hold is zero, and pays exactly once however often it is asked', async () => {
    if (!databaseAvailable) return;
    await setHoldDays(0);
    const { referrerId, refereeId, redemptionId } = await redeemedPair();
    await completeARide(refereeId);

    expect(await service.advance(redemptionId)).toBe(ReferralRedemptionStatus.PAID);
    // Replaying is the realistic failure — a sweep overlapping a ride event.
    // Both credits are keyed on the redemption id, so the second pass is a
    // no-op at the wallet rather than a second ₦350.
    await service.advance(redemptionId);
    await service.advance(redemptionId);

    const referrerWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, referrerId);
    const refereeWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, refereeId);
    expect(referrerWallet.availableBalance).toBe(350);
    expect(refereeWallet.availableBalance).toBe(350);
  });

  it('refuses a referral whose two accounts share a phone line written differently', async () => {
    if (!databaseAvailable) return;
    // Neither account can hold the same string — `User.phone` is unique — so
    // this is only caught by comparing the line rather than the text.
    const suffix = String(Date.now()).slice(-7);
    const referrerId = await createUser('shared-referrer', `+234801${suffix}`);
    const refereeId = await createUser('shared-referee', `0801${suffix}`);
    const referral = await prisma.referral.create({
      data: {
        userId: referrerId,
        ownerType: ReferralOwnerType.CUSTOMER,
        code: randomUUID().slice(0, 10).toUpperCase(),
      },
    });
    const redemption = await prisma.referralRedemption.create({
      data: {
        referralId: referral.id,
        refereeUserId: refereeId,
        refereeType: ReferralRefereeType.CUSTOMER,
      },
    });
    await completeARide(refereeId);

    expect(await service.advance(redemption.id)).toBe(ReferralRedemptionStatus.PENDING);

    const stored = await prisma.referralRedemption.findUniqueOrThrow({
      where: { id: redemption.id },
    });
    expect(stored.status).toBe(ReferralRedemptionStatus.REJECTED);
    expect(stored.rejectionReason).toBe(ReferralRejectionReason.SHARED_PHONE);

    const referrerWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, referrerId);
    expect(referrerWallet.availableBalance).toBe(0);
  });

  it('flags a shared device rather than refusing it, and holds it for Operations', async () => {
    if (!databaseAvailable) return;
    // A household sharing a handset is not fraud. Refusing on this signal would
    // reject real referrals in bulk, so it is looked at instead.
    await setHoldDays(0);
    const { referrerId, refereeId, redemptionId } = await redeemedPair();
    const deviceId = `device-${randomUUID()}`;
    for (const userId of [referrerId, refereeId]) {
      await prisma.authSession.create({
        data: {
          userId,
          portal: 'CUSTOMER_WEB',
          deviceId,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    }
    await completeARide(refereeId);

    expect(await service.advance(redemptionId)).toBe(ReferralRedemptionStatus.QUALIFIED);

    const stored = await prisma.referralRedemption.findUniqueOrThrow({
      where: { id: redemptionId },
    });
    expect(stored.flaggedReason).toBe(ReferralRejectionReason.SHARED_DEVICE);
    // Held despite a zero hold: the flag is not released by a timer.
    const referrerWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, referrerId);
    expect(referrerWallet.availableBalance).toBe(0);
  });

  it('lets Operations clear a flag, which pays it', async () => {
    if (!databaseAvailable) return;
    await setHoldDays(0);
    const { referrerId, refereeId, redemptionId } = await redeemedPair();
    const deviceId = `device-${randomUUID()}`;
    for (const userId of [referrerId, refereeId]) {
      await prisma.authSession.create({
        data: {
          userId,
          portal: 'CUSTOMER_WEB',
          deviceId,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    }
    await completeARide(refereeId);
    await service.advance(redemptionId);

    const adminId = await createUser('admin');
    expect(await service.approve(redemptionId, 'Her brother, same handset', adminId)).toBe(
      ReferralRedemptionStatus.PAID,
    );

    const referrerWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, referrerId);
    expect(referrerWallet.availableBalance).toBe(350);
  });

  it('expires a referral whose window closed before the referee ever transacted', async () => {
    if (!databaseAvailable) return;
    const { referrerId, refereeId, redemptionId } = await redeemedPair();
    await prisma.referralRedemption.update({
      where: { id: redemptionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    // Even a milestone met after the window does not revive it.
    await completeARide(refereeId);

    expect(await service.advance(redemptionId)).toBe(ReferralRedemptionStatus.EXPIRED);

    const referrerWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, referrerId);
    expect(referrerWallet.availableBalance).toBe(0);
  });

  it('reverses a paid reward by moving the money back, not by relabelling the row', async () => {
    if (!databaseAvailable) return;
    await setHoldDays(0);
    const { referrerId, refereeId, redemptionId } = await redeemedPair();
    await completeARide(refereeId);
    await service.advance(redemptionId);

    const adminId = await createUser('reverser');
    expect(await service.reverse(redemptionId, 'Fake account ring', adminId)).toBe(
      ReferralRedemptionStatus.REVERSED,
    );

    const referrerWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, referrerId);
    const refereeWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, refereeId);
    expect(referrerWallet.availableBalance).toBe(0);
    expect(refereeWallet.availableBalance).toBe(0);

    const reversals = await prisma.walletLedgerEntry.count({
      where: {
        referenceId: redemptionId,
        referenceType: {
          in: [
            REFERRAL_WALLET_REFERENCE_TYPES.REFERRER_REVERSAL,
            REFERRAL_WALLET_REFERENCE_TYPES.REFEREE_REVERSAL,
          ],
        },
      },
    });
    expect(reversals).toBe(2);
  });

  it('refuses to reject a referral that has already been paid', async () => {
    if (!databaseAvailable) return;
    // A "rejected" row whose credits are still sitting in two wallets is a lie
    // the ledger would not agree with.
    await setHoldDays(0);
    const { refereeId, redemptionId } = await redeemedPair();
    await completeARide(refereeId);
    await service.advance(redemptionId);

    const adminId = await createUser('rejecter');
    await expect(
      service.reject(redemptionId, ReferralRejectionReason.OPERATIONS_DECISION, null, adminId),
    ).rejects.toThrow(/reverse it instead/i);
  });

  it('qualifies a customer on a completed order, not only on a ride', async () => {
    if (!databaseAvailable) return;
    // Deliberate widening, DPX-REFERRAL-003. Before this only a ride counted,
    // so a referred customer who orders food every week and has never taken a
    // ride left their referrer unpaid forever — the referral did exactly what
    // DrippleX wanted and paid nobody.
    await setHoldDays(0);
    const { referrerId, refereeId, redemptionId } = await redeemedPair();
    const merchantId = await createUser('order-merchant');
    await completeAnOrder(refereeId, merchantId);

    expect(await service.advance(redemptionId)).toBe(ReferralRedemptionStatus.PAID);

    const referrerWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, referrerId);
    expect(referrerWallet.availableBalance).toBe(350);
  });

  it('holds a merchant referral until verification, a bank account and a first order are all true', async () => {
    if (!databaseAvailable) return;
    // Each on its own is reachable without ever trading: a shop can be
    // registered and verified and never open, and a bank account can be added
    // to an empty one.
    await setHoldDays(0, ReferralRefereeType.MERCHANT);
    const referrerId = await createUser('merchant-referrer');
    const merchantId = await createUser('merchant-referee');
    const referral = await prisma.referral.create({
      data: {
        userId: referrerId,
        ownerType: ReferralOwnerType.CUSTOMER,
        code: randomUUID().slice(0, 10).toUpperCase(),
      },
    });
    const redemption = await prisma.referralRedemption.create({
      data: {
        referralId: referral.id,
        refereeUserId: merchantId,
        refereeType: ReferralRefereeType.MERCHANT,
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    });

    // No business at all.
    expect(await service.advance(redemption.id)).toBe(ReferralRedemptionStatus.PENDING);

    const business = await createBusiness(merchantId, BusinessVerificationStatus.PENDING);
    expect(await service.advance(redemption.id)).toBe(ReferralRedemptionStatus.PENDING);

    await prisma.business.update({
      where: { id: business.id },
      data: { verificationStatus: BusinessVerificationStatus.VERIFIED },
    });
    // Verified, but no bank account.
    expect(await service.advance(redemption.id)).toBe(ReferralRedemptionStatus.PENDING);

    await prisma.bankAccount.create({
      data: {
        merchantId,
        bankName: 'Test Bank',
        accountName: 'Test Merchant',
        accountNumber: String(Date.now()).slice(-10),
      },
    });
    // Bank account, but nothing sold.
    expect(await service.advance(redemption.id)).toBe(ReferralRedemptionStatus.PENDING);

    const customerId = await createUser('merchant-customer');
    await completeAnOrder(customerId, merchantId);
    expect(await service.advance(redemption.id)).toBe(ReferralRedemptionStatus.PAID);

    const referrerWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, referrerId);
    expect(referrerWallet.availableBalance).toBe(350);
  });

  it('prices a fleet referral from its own programme, and pays the referee nothing', async () => {
    if (!databaseAvailable) return;
    // ₦2,500 to whoever brought the fleet and nothing to the fleet itself — a
    // company is signed up by its owner, not tempted in by a welcome bonus.
    const fleetProgramme = await prisma.referralProgramme.findUniqueOrThrow({
      where: { refereeType: ReferralRefereeType.FLEET },
    });
    expect(Number(fleetProgramme.referrerRewardAmount)).toBe(2500);
    expect(Number(fleetProgramme.refereeRewardAmount)).toBe(0);
    // And 2,500 is naira, not a points threshold: it is a reward amount on a
    // wallet-crediting programme, the same column the ₦350 customer reward uses.
    const customerProgramme = await prisma.referralProgramme.findUniqueOrThrow({
      where: { refereeType: ReferralRefereeType.CUSTOMER },
    });
    expect(Number(customerProgramme.referrerRewardAmount)).toBe(350);
  });
});
