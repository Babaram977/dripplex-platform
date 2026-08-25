import { Prisma, ReferralRedemptionStatus, RideStatus, WalletOwnerType } from '@prisma/client';

import { DOMAIN_EVENTS } from '../events/domain-events';

import { REFERRAL_REWARD_AMOUNTS, REFERRAL_WALLET_REFERENCE_TYPES } from './referral.constants';
import { ReferralsService } from './referrals.service';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';
import type { WalletService } from '../wallet/wallet.service';

describe('ReferralsService', () => {
  let prisma: {
    referral: { findUnique: jest.Mock; create: jest.Mock };
    referralRedemption: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    ride: { count: jest.Mock };
  };
  let auditService: jest.Mocked<AuditService>;
  let eventBus: jest.Mocked<DomainEventBus>;
  let walletService: jest.Mocked<WalletService>;
  let service: ReferralsService;

  beforeEach(() => {
    prisma = {
      referral: { findUnique: jest.fn(), create: jest.fn() },
      referralRedemption: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      ride: { count: jest.fn() },
    };
    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;
    eventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DomainEventBus>;
    walletService = {
      credit: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<WalletService>;
    service = new ReferralsService(
      prisma as unknown as PrismaService,
      auditService,
      eventBus,
      walletService,
    );
  });

  describe('getOrCreateMyCode', () => {
    it('returns the existing referral when one already exists', async () => {
      prisma.referral.findUnique.mockResolvedValue({
        id: 'ref-1',
        userId: 'user-1',
        code: 'ABCD1234',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getOrCreateMyCode('user-1');

      expect(result.code).toBe('ABCD1234');
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it('creates a new referral code when none exists', async () => {
      prisma.referral.findUnique.mockResolvedValueOnce(null);
      prisma.referral.create.mockResolvedValue({
        id: 'ref-2',
        userId: 'user-2',
        code: 'WXYZ5678',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getOrCreateMyCode('user-2');

      expect(result.code).toBe('WXYZ5678');
      expect(auditService.record).toHaveBeenCalledWith(
        'referral.code_generated',
        expect.objectContaining({ userId: 'user-2' }),
        expect.objectContaining({ resource: 'referral', resourceId: 'ref-2' }),
      );
    });

    it('returns the race winner when a concurrent request already created the code', async () => {
      prisma.referral.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'ref-3',
        userId: 'user-3',
        code: 'RACE0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.referral.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );

      const result = await service.getOrCreateMyCode('user-3');

      expect(result.code).toBe('RACE0000');
    });
  });

  describe('getStats', () => {
    it('aggregates redemption counts by status', async () => {
      prisma.referral.findUnique.mockResolvedValue({
        id: 'ref-4',
        userId: 'user-4',
        code: 'STAT0001',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.referralRedemption.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3);

      const stats = await service.getStats('user-4');

      expect(stats).toEqual({
        code: 'STAT0001',
        totalRedemptions: 5,
        pendingRedemptions: 2,
        rewardedRedemptions: 3,
        // Both amounts come from REFERRAL_REWARD_AMOUNTS rather than being
        // repeated here, so a founder changing the reward cannot leave this
        // test asserting the old number.
        refereeRewardAmount: REFERRAL_REWARD_AMOUNTS.REFEREE,
        referrerRewardAmount: REFERRAL_REWARD_AMOUNTS.REFERRER,
      });
    });
  });

  describe('tryRedeemAtRegistration', () => {
    it('skips malformed codes without throwing', async () => {
      await expect(service.tryRedeemAtRegistration('referee-1', 'a', {})).resolves.toBeUndefined();
      expect(prisma.referral.findUnique).not.toHaveBeenCalled();
    });

    it('skips unknown codes', async () => {
      prisma.referral.findUnique.mockResolvedValue(null);

      await service.tryRedeemAtRegistration('referee-1', 'UNKNOWN1', {});

      expect(prisma.referralRedemption.create).not.toHaveBeenCalled();
    });

    it('skips self-referral', async () => {
      prisma.referral.findUnique.mockResolvedValue({
        id: 'ref-5',
        userId: 'referee-1',
        code: 'SELF0001',
      });

      await service.tryRedeemAtRegistration('referee-1', 'SELF0001', {});

      expect(prisma.referralRedemption.create).not.toHaveBeenCalled();
    });

    it('creates a redemption and emits REFERRAL_REDEEMED for a valid code', async () => {
      prisma.referral.findUnique.mockResolvedValue({
        id: 'ref-6',
        userId: 'referrer-1',
        code: 'VALID001',
      });
      prisma.referralRedemption.create.mockResolvedValue({ id: 'redemption-1' });

      await service.tryRedeemAtRegistration('referee-1', 'valid001', {});

      expect(prisma.referralRedemption.create).toHaveBeenCalledWith({
        data: { referralId: 'ref-6', refereeUserId: 'referee-1' },
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.REFERRAL_REDEEMED,
        { userId: 'referrer-1', refereeUserId: 'referee-1', code: 'VALID001' },
        { actorUserId: 'referee-1' },
      );
    });

    it('never throws even if redemption creation fails', async () => {
      prisma.referral.findUnique.mockResolvedValue({ id: 'ref-7', userId: 'referrer-2' });
      prisma.referralRedemption.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.tryRedeemAtRegistration('referee-2', 'ERRCODE1', {}),
      ).resolves.toBeUndefined();
    });
  });

  describe('handleRefereeRideCompleted', () => {
    it('does nothing when the customer has no referral redemption', async () => {
      prisma.referralRedemption.findUnique.mockResolvedValue(null);

      await service.handleRefereeRideCompleted('customer-1');

      expect(walletService.credit).not.toHaveBeenCalled();
    });

    it('does nothing when the redemption is already rewarded', async () => {
      prisma.referralRedemption.findUnique.mockResolvedValue({
        id: 'redemption-2',
        status: ReferralRedemptionStatus.REWARDED,
        referral: { userId: 'referrer-3' },
      });

      await service.handleRefereeRideCompleted('customer-2');

      expect(walletService.credit).not.toHaveBeenCalled();
    });

    it('does nothing when this is not the first completed ride', async () => {
      prisma.referralRedemption.findUnique.mockResolvedValue({
        id: 'redemption-3',
        status: ReferralRedemptionStatus.PENDING,
        referral: { userId: 'referrer-4' },
      });
      prisma.ride.count.mockResolvedValue(2);

      await service.handleRefereeRideCompleted('customer-3');

      expect(walletService.credit).not.toHaveBeenCalled();
      expect(prisma.referralRedemption.update).not.toHaveBeenCalled();
    });

    it('credits both wallets and marks the redemption rewarded on the first completed ride', async () => {
      prisma.referralRedemption.findUnique.mockResolvedValue({
        id: 'redemption-4',
        status: ReferralRedemptionStatus.PENDING,
        referral: { userId: 'referrer-5' },
      });
      prisma.ride.count.mockResolvedValue(1);

      await service.handleRefereeRideCompleted('customer-4');

      expect(walletService.credit).toHaveBeenCalledWith({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: 'referrer-5',
        amount: REFERRAL_REWARD_AMOUNTS.REFERRER,
        referenceType: REFERRAL_WALLET_REFERENCE_TYPES.REFERRER_REWARD,
        referenceId: 'redemption-4',
        description: expect.any(String),
      });
      expect(walletService.credit).toHaveBeenCalledWith({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: 'customer-4',
        amount: REFERRAL_REWARD_AMOUNTS.REFEREE,
        referenceType: REFERRAL_WALLET_REFERENCE_TYPES.REFEREE_REWARD,
        referenceId: 'redemption-4',
        description: expect.any(String),
      });
      expect(prisma.referralRedemption.update).toHaveBeenCalledWith({
        where: { id: 'redemption-4' },
        data: { status: ReferralRedemptionStatus.REWARDED, rewardedAt: expect.any(Date) },
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.REFERRAL_REWARDED,
        {
          userId: 'referrer-5',
          amount: String(REFERRAL_REWARD_AMOUNTS.REFERRER),
          role: 'referrer',
        },
        { actorUserId: 'customer-4' },
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.REFERRAL_REWARDED,
        {
          userId: 'customer-4',
          amount: String(REFERRAL_REWARD_AMOUNTS.REFEREE),
          role: 'referee',
        },
        { actorUserId: 'customer-4' },
      );
      expect(prisma.ride.count).toHaveBeenCalledWith({
        where: { customerId: 'customer-4', status: RideStatus.COMPLETED },
      });
    });
  });
});
