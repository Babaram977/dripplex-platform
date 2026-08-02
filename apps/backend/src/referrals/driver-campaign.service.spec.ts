import {
  DriverReferralRewardStatus,
  DriverStatus,
  Prisma,
  ReferralCampaignStatus,
  ReferralCampaignTier,
  ReferralFraudCheckStatus,
  WalletOwnerType,
} from '@prisma/client';

import { DOMAIN_EVENTS } from '../events/domain-events';

import { DriverCampaignService } from './driver-campaign.service';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';
import type { WalletService } from '../wallet/wallet.service';

const campaign = {
  id: 'campaign-1',
  name: 'August Growth',
  periodStart: new Date('2026-08-01T00:00:00.000Z'),
  periodEnd: new Date('2026-08-31T23:59:59.999Z'),
  status: ReferralCampaignStatus.ACTIVE,
  requiredTripsPerPassenger: 5,
  silverThreshold: 50,
  silverRewardAmount: new Prisma.Decimal(40000),
  goldThreshold: 100,
  goldRewardAmount: new Prisma.Decimal(100000),
  goldQualificationRate: new Prisma.Decimal(0.75),
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const approvedDriverProfile = {
  id: 'profile-1',
  userId: 'driver-1',
  status: DriverStatus.APPROVED,
  isApproved: true,
  approvedAt: new Date(),
  approvedBy: null,
  rejectedReason: null,
  suspendedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('DriverCampaignService', () => {
  let prisma: {
    driverProfile: { findUnique: jest.Mock };
    referralCampaign: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    driverReferral: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock };
    referralStatistics: { create: jest.Mock; update: jest.Mock };
    passengerReferral: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    referralReward: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    referralFraudCheck: {
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    referral: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: jest.Mocked<AuditService>;
  let eventBus: jest.Mocked<DomainEventBus>;
  let walletService: jest.Mocked<WalletService>;
  let service: DriverCampaignService;

  beforeEach(() => {
    prisma = {
      driverProfile: { findUnique: jest.fn() },
      referralCampaign: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      driverReferral: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
      referralStatistics: { create: jest.fn(), update: jest.fn() },
      passengerReferral: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      referralReward: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      referralFraudCheck: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      referral: { findUnique: jest.fn() },
      $transaction: jest.fn(),
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
    service = new DriverCampaignService(
      prisma as unknown as PrismaService,
      auditService,
      eventBus,
      walletService,
    );
  });

  describe('getOrCreateMyCode', () => {
    it('rejects drivers who are not approved and active', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue({
        ...approvedDriverProfile,
        status: DriverStatus.PENDING,
      });

      await expect(service.getOrCreateMyCode('driver-1', {})).rejects.toThrow(
        'Only active, verified drivers can participate in the referral campaign',
      );
    });

    it('rejects when there is no active campaign', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue(approvedDriverProfile);
      prisma.referralCampaign.findFirst.mockResolvedValue(null);

      await expect(service.getOrCreateMyCode('driver-1', {})).rejects.toThrow(
        'No active driver referral campaign right now',
      );
    });

    it('returns the existing driver referral when one already exists for the campaign', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue(approvedDriverProfile);
      prisma.referralCampaign.findFirst.mockResolvedValue(campaign);
      const existing = {
        id: 'dr-1',
        campaignId: campaign.id,
        driverId: 'driver-1',
        code: 'DRVR0001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.driverReferral.findUnique.mockResolvedValue(existing);

      const result = await service.getOrCreateMyCode('driver-1', {});

      expect(result.referral).toEqual(existing);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a code and statistics row transactionally when none exists', async () => {
      prisma.driverProfile.findUnique.mockResolvedValue(approvedDriverProfile);
      prisma.referralCampaign.findFirst.mockResolvedValue(campaign);
      prisma.driverReferral.findUnique.mockResolvedValue(null);
      prisma.referral.findUnique.mockResolvedValue(null);
      const created = {
        id: 'dr-2',
        campaignId: campaign.id,
        driverId: 'driver-1',
        code: 'NEWCODE1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const tx = {
        driverReferral: { create: jest.fn().mockResolvedValue(created) },
        referralStatistics: { create: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => await callback(tx),
      );

      const result = await service.getOrCreateMyCode('driver-1', {});

      expect(result.referral).toEqual(created);
      expect(tx.driverReferral.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ campaignId: campaign.id, driverId: 'driver-1' }),
        }),
      );
      expect(tx.referralStatistics.create).toHaveBeenCalledWith({
        data: { driverReferralId: created.id },
      });
    });
  });

  describe('tryRedeemDriverCode', () => {
    it('returns false for a code that does not belong to the driver-campaign namespace', async () => {
      prisma.driverReferral.findUnique.mockResolvedValue(null);

      const claimed = await service.tryRedeemDriverCode('referee-1', 'NOTFOUND', {});

      expect(claimed).toBe(false);
      expect(prisma.passengerReferral.create).not.toHaveBeenCalled();
    });

    it('claims the code but rejects self-referral', async () => {
      prisma.driverReferral.findUnique.mockResolvedValue({
        id: 'dr-1',
        campaignId: campaign.id,
        driverId: 'driver-1',
        code: 'SELFCODE',
        campaign,
      });

      const claimed = await service.tryRedeemDriverCode('driver-1', 'SELFCODE', {});

      expect(claimed).toBe(true);
      expect(prisma.referralFraudCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            checkType: 'SELF_REFERRAL',
            status: ReferralFraudCheckStatus.REJECTED,
          }),
        }),
      );
      expect(prisma.passengerReferral.create).not.toHaveBeenCalled();
    });

    it('claims the code but rejects a referee who already has a passenger referral', async () => {
      prisma.driverReferral.findUnique.mockResolvedValue({
        id: 'dr-1',
        campaignId: campaign.id,
        driverId: 'driver-1',
        code: 'DUPCODE1',
        campaign,
      });
      prisma.passengerReferral.findUnique.mockResolvedValue({ id: 'existing-passenger-referral' });

      const claimed = await service.tryRedeemDriverCode('referee-1', 'DUPCODE1', {});

      expect(claimed).toBe(true);
      expect(prisma.referralFraudCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ checkType: 'DUPLICATE_REFEREE' }),
        }),
      );
      expect(prisma.passengerReferral.create).not.toHaveBeenCalled();
    });

    it('skips silently when the campaign is not active', async () => {
      prisma.driverReferral.findUnique.mockResolvedValue({
        id: 'dr-1',
        campaignId: campaign.id,
        driverId: 'driver-1',
        code: 'PAUSED01',
        campaign: { ...campaign, status: ReferralCampaignStatus.PAUSED },
      });

      const claimed = await service.tryRedeemDriverCode('referee-1', 'PAUSED01', {});

      expect(claimed).toBe(true);
      expect(prisma.passengerReferral.create).not.toHaveBeenCalled();
    });

    it('creates a passenger referral and notifies the driver for a valid redemption', async () => {
      prisma.driverReferral.findUnique.mockResolvedValue({
        id: 'dr-1',
        campaignId: campaign.id,
        driverId: 'driver-1',
        code: 'VALIDCOD',
        campaign,
      });
      prisma.passengerReferral.findUnique.mockResolvedValue(null);
      prisma.passengerReferral.create.mockResolvedValue({ id: 'pr-1' });

      const claimed = await service.tryRedeemDriverCode('referee-1', 'validcod', {});

      expect(claimed).toBe(true);
      expect(prisma.passengerReferral.create).toHaveBeenCalledWith({
        data: { driverReferralId: 'dr-1', refereeUserId: 'referee-1' },
      });
      expect(prisma.referralStatistics.update).toHaveBeenCalledWith({
        where: { driverReferralId: 'dr-1' },
        data: { registeredCount: { increment: 1 } },
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.DRIVER_REFERRAL_PASSENGER_REGISTERED,
        { userId: 'driver-1', refereeUserId: 'referee-1', campaignId: campaign.id },
        { actorUserId: 'referee-1' },
      );
    });
  });

  describe('handleRidePaymentSucceeded', () => {
    it('does nothing when the customer has no passenger referral', async () => {
      prisma.passengerReferral.findUnique.mockResolvedValue(null);

      await service.handleRidePaymentSucceeded('customer-1');

      expect(prisma.passengerReferral.update).not.toHaveBeenCalled();
    });

    it('does nothing once already qualified', async () => {
      prisma.passengerReferral.findUnique.mockResolvedValue({ status: 'QUALIFIED' });

      await service.handleRidePaymentSucceeded('customer-2');

      expect(prisma.passengerReferral.update).not.toHaveBeenCalled();
    });

    it('does nothing when the campaign has already ended', async () => {
      prisma.passengerReferral.findUnique.mockResolvedValue({
        id: 'pr-1',
        status: 'REGISTERED',
        completedTrips: 0,
        driverReferral: {
          id: 'dr-1',
          driverId: 'driver-1',
          statistics: { qualifiedCount: 0, registeredCount: 1 },
          campaign: { ...campaign, status: ReferralCampaignStatus.ENDED },
        },
      });

      await service.handleRidePaymentSucceeded('customer-3');

      expect(prisma.passengerReferral.update).not.toHaveBeenCalled();
    });

    it('increments completed trips without qualifying below the threshold', async () => {
      prisma.passengerReferral.findUnique.mockResolvedValue({
        id: 'pr-1',
        status: 'REGISTERED',
        completedTrips: 2,
        driverReferral: {
          id: 'dr-1',
          driverId: 'driver-1',
          statistics: { qualifiedCount: 0, registeredCount: 1 },
          campaign,
        },
      });

      await service.handleRidePaymentSucceeded('customer-4');

      expect(prisma.passengerReferral.update).toHaveBeenCalledWith({
        where: { id: 'pr-1' },
        data: { completedTrips: 3 },
      });
      expect(eventBus.emit).not.toHaveBeenCalledWith(
        DOMAIN_EVENTS.DRIVER_REFERRAL_PASSENGER_QUALIFIED,
        expect.anything(),
        expect.anything(),
      );
    });

    it('qualifies the passenger on the 5th completed trip and recomputes the driver tier', async () => {
      prisma.passengerReferral.findUnique.mockResolvedValue({
        id: 'pr-1',
        status: 'REGISTERED',
        completedTrips: 4,
        driverReferral: {
          id: 'dr-1',
          driverId: 'driver-1',
          statistics: { qualifiedCount: 49, registeredCount: 60 },
          campaign,
        },
      });
      // recomputeTier's internal lookup
      prisma.driverReferral.findUnique.mockResolvedValue({
        id: 'dr-1',
        campaignId: campaign.id,
        driverId: 'driver-1',
        campaign,
        statistics: {
          driverReferralId: 'dr-1',
          currentTier: ReferralCampaignTier.NONE,
          qualifiedCount: 50,
          registeredCount: 60,
          invitesSent: 0,
          completedTrips: 10,
          updatedAt: new Date(),
        },
      });

      await service.handleRidePaymentSucceeded('customer-5');

      expect(prisma.passengerReferral.update).toHaveBeenCalledWith({
        where: { id: 'pr-1' },
        data: { completedTrips: 5, status: 'QUALIFIED', qualifiedAt: expect.any(Date) },
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.DRIVER_REFERRAL_PASSENGER_QUALIFIED,
        { userId: 'driver-1', refereeUserId: 'customer-5', campaignId: campaign.id },
        { actorUserId: 'customer-5' },
      );
      // tier recompute: 50 qualified >= silverThreshold(50) -> SILVER
      expect(prisma.referralStatistics.update).toHaveBeenCalledWith({
        where: { driverReferralId: 'dr-1' },
        data: { currentTier: ReferralCampaignTier.SILVER },
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.DRIVER_REFERRAL_TIER_SILVER_REACHED,
        { userId: 'driver-1', campaignId: campaign.id },
      );
      expect(prisma.referralReward.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { campaignId_driverId: { campaignId: campaign.id, driverId: 'driver-1' } },
          create: expect.objectContaining({ tier: ReferralCampaignTier.SILVER, amount: 40000 }),
          update: expect.objectContaining({ tier: ReferralCampaignTier.SILVER, amount: 40000 }),
        }),
      );
    });
  });

  describe('tier computation via reward upsert (Gold rate gate)', () => {
    it('does not award Gold when the qualification rate is below the required threshold', async () => {
      prisma.passengerReferral.findUnique.mockResolvedValue({
        id: 'pr-1',
        status: 'REGISTERED',
        completedTrips: 4,
        driverReferral: {
          id: 'dr-1',
          driverId: 'driver-1',
          statistics: { qualifiedCount: 99, registeredCount: 1000 },
          campaign,
        },
      });
      // 100 qualified out of 1000 registered = 10% rate, below the 75% gold gate
      prisma.driverReferral.findUnique.mockResolvedValue({
        id: 'dr-1',
        campaignId: campaign.id,
        driverId: 'driver-1',
        campaign,
        statistics: {
          driverReferralId: 'dr-1',
          currentTier: ReferralCampaignTier.SILVER,
          qualifiedCount: 100,
          registeredCount: 1000,
          invitesSent: 0,
          completedTrips: 10,
          updatedAt: new Date(),
        },
      });

      await service.handleRidePaymentSucceeded('customer-6');

      expect(eventBus.emit).not.toHaveBeenCalledWith(
        DOMAIN_EVENTS.DRIVER_REFERRAL_TIER_GOLD_REACHED,
        expect.anything(),
      );
      expect(prisma.referralStatistics.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentTier: ReferralCampaignTier.GOLD } }),
      );
    });

    it('awards Gold when both the count and the qualification rate clear the gate', async () => {
      prisma.passengerReferral.findUnique.mockResolvedValue({
        id: 'pr-1',
        status: 'REGISTERED',
        completedTrips: 4,
        driverReferral: {
          id: 'dr-1',
          driverId: 'driver-1',
          statistics: { qualifiedCount: 99, registeredCount: 130 },
          campaign,
        },
      });
      prisma.driverReferral.findUnique.mockResolvedValue({
        id: 'dr-1',
        campaignId: campaign.id,
        driverId: 'driver-1',
        campaign,
        statistics: {
          driverReferralId: 'dr-1',
          currentTier: ReferralCampaignTier.SILVER,
          qualifiedCount: 100,
          registeredCount: 130,
          invitesSent: 0,
          completedTrips: 10,
          updatedAt: new Date(),
        },
      });

      await service.handleRidePaymentSucceeded('customer-7');

      expect(eventBus.emit).toHaveBeenCalledWith(DOMAIN_EVENTS.DRIVER_REFERRAL_TIER_GOLD_REACHED, {
        userId: 'driver-1',
        campaignId: campaign.id,
      });
      expect(prisma.referralReward.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ tier: ReferralCampaignTier.GOLD, amount: 100000 }),
        }),
      );
    });
  });

  describe('reward review lifecycle', () => {
    it('approves a pending reward and emits a notification', async () => {
      prisma.referralReward.findUnique.mockResolvedValue({
        id: 'reward-1',
        driverId: 'driver-1',
        campaignId: campaign.id,
        tier: ReferralCampaignTier.SILVER,
        amount: new Prisma.Decimal(40000),
        status: DriverReferralRewardStatus.PENDING,
        campaign: { ...campaign, status: ReferralCampaignStatus.ENDED },
      });
      prisma.referralReward.update.mockResolvedValue({
        id: 'reward-1',
        driverId: 'driver-1',
        campaignId: campaign.id,
        tier: ReferralCampaignTier.SILVER,
        amount: new Prisma.Decimal(40000),
        qualifiedPassengerCount: 50,
        status: DriverReferralRewardStatus.APPROVED,
        approvedAt: new Date(),
        paidAt: null,
        rejectionReason: null,
        createdAt: new Date(),
      });

      await service.approveReward('reward-1', 'admin-1', {});

      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.DRIVER_REFERRAL_REWARD_APPROVED,
        { userId: 'driver-1', amount: '40000', tier: ReferralCampaignTier.SILVER },
        { actorUserId: 'admin-1' },
      );
    });

    it('rejects approving a reward that is not pending', async () => {
      prisma.referralReward.findUnique.mockResolvedValue({
        id: 'reward-2',
        status: DriverReferralRewardStatus.APPROVED,
        campaign: { ...campaign, status: ReferralCampaignStatus.ENDED },
      });

      await expect(service.approveReward('reward-2', 'admin-1', {})).rejects.toThrow(
        'Only a pending reward can be approved or rejected',
      );
    });

    it('rejects approving a reward while its campaign is still active', async () => {
      prisma.referralReward.findUnique.mockResolvedValue({
        id: 'reward-4',
        driverId: 'driver-1',
        status: DriverReferralRewardStatus.PENDING,
        campaign,
      });

      await expect(service.approveReward('reward-4', 'admin-1', {})).rejects.toThrow(
        'Reward cannot be reviewed until its campaign has ended',
      );
    });

    it('pays an approved reward via the wallet with an idempotent reference', async () => {
      prisma.referralReward.findUnique.mockResolvedValue({
        id: 'reward-1',
        driverId: 'driver-1',
        amount: new Prisma.Decimal(40000),
        tier: ReferralCampaignTier.SILVER,
        status: DriverReferralRewardStatus.APPROVED,
      });
      prisma.referralReward.update.mockResolvedValue({
        id: 'reward-1',
        driverId: 'driver-1',
        campaignId: campaign.id,
        tier: ReferralCampaignTier.SILVER,
        amount: new Prisma.Decimal(40000),
        qualifiedPassengerCount: 50,
        status: DriverReferralRewardStatus.PAID,
        approvedAt: new Date(),
        paidAt: new Date(),
        rejectionReason: null,
        createdAt: new Date(),
      });

      await service.payReward('reward-1', 'admin-1', {});

      expect(walletService.credit).toHaveBeenCalledWith({
        ownerType: WalletOwnerType.DRIVER,
        ownerId: 'driver-1',
        amount: expect.anything(),
        referenceType: 'driver_referral_campaign_reward',
        referenceId: 'reward-1',
        description: expect.any(String),
        context: {},
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DOMAIN_EVENTS.DRIVER_REFERRAL_REWARD_PAID,
        { userId: 'driver-1', amount: '40000', tier: ReferralCampaignTier.SILVER },
        { actorUserId: 'admin-1' },
      );
    });

    it('refuses to pay a reward that has not been approved', async () => {
      prisma.referralReward.findUnique.mockResolvedValue({
        id: 'reward-3',
        status: DriverReferralRewardStatus.PENDING,
      });

      await expect(service.payReward('reward-3', 'admin-1', {})).rejects.toThrow(
        'Reward must be approved before it can be paid',
      );
      expect(walletService.credit).not.toHaveBeenCalled();
    });
  });

  describe('campaign sweep', () => {
    it('activates due campaigns and ends expired ones', async () => {
      prisma.referralCampaign.updateMany.mockResolvedValueOnce({ count: 2 });
      prisma.referralCampaign.updateMany.mockResolvedValueOnce({ count: 1 });

      const activated = await service.activateDueCampaigns();
      const ended = await service.endExpiredCampaigns();

      expect(activated).toBe(2);
      expect(ended).toBe(1);
      expect(prisma.referralCampaign.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          status: ReferralCampaignStatus.DRAFT,
          periodStart: { lte: expect.any(Date) },
          periodEnd: { gte: expect.any(Date) },
        },
        data: { status: ReferralCampaignStatus.ACTIVE },
      });
      expect(prisma.referralCampaign.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          status: { in: [ReferralCampaignStatus.ACTIVE, ReferralCampaignStatus.PAUSED] },
          periodEnd: { lt: expect.any(Date) },
        },
        data: { status: ReferralCampaignStatus.ENDED },
      });
    });
  });
});
