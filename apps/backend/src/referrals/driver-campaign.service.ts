import { Injectable, Logger } from '@nestjs/common';
import {
  DriverReferralRewardStatus,
  DriverStatus,
  Prisma,
  ReferralCampaignStatus,
  ReferralCampaignTier,
  ReferralFraudCheckStatus,
  ReferralFraudCheckType,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import {
  DRIVER_CAMPAIGN_AUDIT_ACTIONS,
  DRIVER_CAMPAIGN_WALLET_REFERENCE_TYPE,
} from './driver-campaign.constants';
import {
  toDriverReferralDto,
  toReferralCampaignDto,
  toReferralFraudCheckDto,
  toReferralRewardDto,
  toReferralStatisticsDto,
  type DriverCampaignDashboardDto,
  type DriverLeaderboardEntryDto,
  type LeaderboardEntryDto,
  type ReferralCampaignDto,
  type ReferralFraudCheckDto,
  type ReferralRewardDto,
} from './driver-campaign.mapper';
import { generateReferralCode } from './referral-code.util';
import { REFERRAL_CODE_MAX_GENERATION_ATTEMPTS, REFERRAL_CODE_PATTERN } from './referral.constants';

import type {
  DriverReferral,
  ReferralCampaign,
  ReferralReward,
  ReferralStatistics,
} from '@prisma/client';

export interface CreateCampaignInput {
  name: string;
  periodStart: Date;
  periodEnd: Date;
  requiredTripsPerPassenger?: number;
  silverThreshold?: number;
  silverRewardAmount?: number;
  goldThreshold?: number;
  goldRewardAmount?: number;
  goldQualificationRate?: number;
}

export interface UpdateCampaignRewardsInput {
  silverRewardAmount?: number;
  goldRewardAmount?: number;
  silverThreshold?: number;
  goldThreshold?: number;
  goldQualificationRate?: number;
}

@Injectable()
export class DriverCampaignService {
  private readonly logger = new Logger(DriverCampaignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: DomainEventBus,
    private readonly walletService: WalletService,
  ) {}

  // ---------------------------------------------------------------------
  // Driver-facing
  // ---------------------------------------------------------------------

  public async getOrCreateMyCode(
    driverId: string,
    context: AuditContext,
  ): Promise<{ campaign: ReferralCampaignDto; referral: DriverReferral }> {
    await this.requireEligibleDriver(driverId);
    const campaign = await this.requireActiveCampaign();

    const existing = await this.prisma.driverReferral.findUnique({
      where: { campaignId_driverId: { campaignId: campaign.id, driverId } },
    });
    if (existing) {
      return { campaign: toReferralCampaignDto(campaign), referral: existing };
    }

    for (let attempt = 0; attempt < REFERRAL_CODE_MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const code = generateReferralCode();
      const collision = await this.codeExists(code);
      if (collision) {
        continue;
      }
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const referral = await tx.driverReferral.create({
            data: { campaignId: campaign.id, driverId, code },
          });
          await tx.referralStatistics.create({ data: { driverReferralId: referral.id } });
          return referral;
        });
        await this.auditService.record(
          DRIVER_CAMPAIGN_AUDIT_ACTIONS.CODE_GENERATED,
          { ...context, userId: driverId },
          {
            resource: 'driver_referral',
            resourceId: created.id,
            metadata: { campaignId: campaign.id },
          },
        );
        return { campaign: toReferralCampaignDto(campaign), referral: created };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictDomainException(
      'Could not generate a unique driver referral code, please retry',
    );
  }

  public async recordInviteTap(driverId: string): Promise<void> {
    const campaign = await this.requireActiveCampaign();
    const referral = await this.prisma.driverReferral.findUnique({
      where: { campaignId_driverId: { campaignId: campaign.id, driverId } },
    });
    if (!referral) {
      throw new NotFoundDomainException('Generate your referral code before sharing it');
    }
    await this.prisma.referralStatistics.update({
      where: { driverReferralId: referral.id },
      data: { invitesSent: { increment: 1 } },
    });
  }

  public async getDashboard(driverId: string): Promise<DriverCampaignDashboardDto> {
    const campaign = await this.findActiveCampaign();
    if (!campaign) {
      const rewardHistory = await this.getRewardHistory(driverId);
      return {
        campaign: null,
        referral: null,
        statistics: null,
        progressToSilver: 0,
        progressToGold: 0,
        estimatedRewardAmount: 0,
        estimatedTier: ReferralCampaignTier.NONE,
        campaignCountdownSeconds: null,
        rewardHistory,
      };
    }

    const referral = await this.prisma.driverReferral.findUnique({
      where: { campaignId_driverId: { campaignId: campaign.id, driverId } },
      include: { statistics: true },
    });
    const rewardHistory = await this.getRewardHistory(driverId);

    if (!referral?.statistics) {
      return {
        campaign: toReferralCampaignDto(campaign),
        referral: null,
        statistics: null,
        progressToSilver: 0,
        progressToGold: 0,
        estimatedRewardAmount: 0,
        estimatedTier: ReferralCampaignTier.NONE,
        campaignCountdownSeconds: this.secondsUntil(campaign.periodEnd),
        rewardHistory,
      };
    }

    const tier = this.computeTier(campaign, referral.statistics);
    return {
      campaign: toReferralCampaignDto(campaign),
      referral: toDriverReferralDto(referral),
      statistics: toReferralStatisticsDto(referral.statistics),
      progressToSilver: Math.min(1, referral.statistics.qualifiedCount / campaign.silverThreshold),
      progressToGold: Math.min(1, referral.statistics.qualifiedCount / campaign.goldThreshold),
      estimatedRewardAmount: this.rewardAmountForTier(campaign, tier),
      estimatedTier: tier,
      campaignCountdownSeconds: this.secondsUntil(campaign.periodEnd),
      rewardHistory,
    };
  }

  /**
   * Called from RegistrationService alongside ReferralsService.tryRedeemAtRegistration.
   * Returns true when `rawCode` belongs to the driver-campaign code namespace
   * (whether or not the referral was ultimately accepted) so the caller
   * knows not to also try the generic customer Referral system — the two
   * namespaces never overlap (see codeExists()).
   */
  public async tryRedeemDriverCode(
    refereeUserId: string,
    rawCode: string,
    context: AuditContext,
  ): Promise<boolean> {
    const code = rawCode.trim().toUpperCase();
    if (!REFERRAL_CODE_PATTERN.test(code)) {
      return false;
    }

    const driverReferral = await this.prisma.driverReferral.findUnique({
      where: { code },
      include: { campaign: true },
    });
    if (!driverReferral) {
      return false;
    }

    try {
      if (driverReferral.campaign.status !== ReferralCampaignStatus.ACTIVE) {
        this.logger.warn(
          `Driver referral code ${code} used but campaign ${driverReferral.campaignId} is not active`,
        );
        return true;
      }

      if (driverReferral.driverId === refereeUserId) {
        await this.recordFraudCheck(
          null,
          driverReferral.id,
          ReferralFraudCheckType.SELF_REFERRAL,
          ReferralFraudCheckStatus.REJECTED,
          'Referee is the same user as the referring driver',
        );
        return true;
      }

      const alreadyReferred = await this.prisma.passengerReferral.findUnique({
        where: { refereeUserId },
      });
      if (alreadyReferred) {
        await this.recordFraudCheck(
          alreadyReferred.id,
          driverReferral.id,
          ReferralFraudCheckType.DUPLICATE_REFEREE,
          ReferralFraudCheckStatus.REJECTED,
          'Referee already has a passenger referral record',
        );
        return true;
      }

      const passengerReferral = await this.prisma.passengerReferral.create({
        data: { driverReferralId: driverReferral.id, refereeUserId },
      });
      await this.recordFraudCheck(
        passengerReferral.id,
        driverReferral.id,
        ReferralFraudCheckType.SELF_REFERRAL,
        ReferralFraudCheckStatus.CLEARED,
        'Automatic check passed at registration',
      );
      await this.prisma.referralStatistics.update({
        where: { driverReferralId: driverReferral.id },
        data: { registeredCount: { increment: 1 } },
      });

      await this.auditService.record(
        DRIVER_CAMPAIGN_AUDIT_ACTIONS.PASSENGER_REGISTERED,
        { ...context, userId: refereeUserId },
        {
          resource: 'passenger_referral',
          resourceId: passengerReferral.id,
          metadata: { driverId: driverReferral.driverId, campaignId: driverReferral.campaignId },
        },
      );
      await this.eventBus.emit(
        DOMAIN_EVENTS.DRIVER_REFERRAL_PASSENGER_REGISTERED,
        { userId: driverReferral.driverId, refereeUserId, campaignId: driverReferral.campaignId },
        { actorUserId: refereeUserId },
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `Driver referral code redemption failed for user ${refereeUserId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return true;
    }
  }

  /**
   * Called by DriverCampaignTripSubscriber on DOMAIN_EVENTS.RIDE_PAYMENT_SUCCEEDED
   * (payment only ever succeeds on a Ride already in COMPLETED status — see
   * RidePaymentService — so this is exactly "a successful paid trip").
   */
  public async handleRidePaymentSucceeded(customerId: string): Promise<void> {
    const passengerReferral = await this.prisma.passengerReferral.findUnique({
      where: { refereeUserId: customerId },
      include: { driverReferral: { include: { campaign: true, statistics: true } } },
    });
    if (!passengerReferral || passengerReferral.status === 'QUALIFIED') {
      return;
    }

    const { driverReferral } = passengerReferral;
    const { campaign } = driverReferral;
    if (
      campaign.status !== ReferralCampaignStatus.ACTIVE ||
      new Date() > campaign.periodEnd ||
      !driverReferral.statistics
    ) {
      return;
    }

    const completedTrips = passengerReferral.completedTrips + 1;
    const nowQualifies = completedTrips >= campaign.requiredTripsPerPassenger;

    await this.prisma.passengerReferral.update({
      where: { id: passengerReferral.id },
      data: {
        completedTrips,
        ...(nowQualifies ? { status: 'QUALIFIED', qualifiedAt: new Date() } : {}),
      },
    });
    await this.prisma.referralStatistics.update({
      where: { driverReferralId: driverReferral.id },
      data: {
        completedTrips: { increment: 1 },
        ...(nowQualifies ? { qualifiedCount: { increment: 1 } } : {}),
      },
    });

    if (!nowQualifies) {
      return;
    }

    await this.auditService.record(
      DRIVER_CAMPAIGN_AUDIT_ACTIONS.PASSENGER_QUALIFIED,
      { userId: customerId },
      {
        resource: 'passenger_referral',
        resourceId: passengerReferral.id,
        metadata: { driverId: driverReferral.driverId, campaignId: campaign.id },
      },
    );
    await this.eventBus.emit(
      DOMAIN_EVENTS.DRIVER_REFERRAL_PASSENGER_QUALIFIED,
      { userId: driverReferral.driverId, refereeUserId: customerId, campaignId: campaign.id },
      { actorUserId: customerId },
    );

    await this.recomputeTier(driverReferral.id);
  }

  // ---------------------------------------------------------------------
  // Admin: campaign lifecycle
  // ---------------------------------------------------------------------

  public async createCampaign(
    input: CreateCampaignInput,
    adminUserId: string,
    context: AuditContext,
  ): Promise<ReferralCampaignDto> {
    if (input.periodEnd <= input.periodStart) {
      throw new ValidationDomainException('periodEnd must be after periodStart');
    }
    const campaign = await this.prisma.referralCampaign.create({
      data: {
        name: input.name,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        createdBy: adminUserId,
        ...(input.requiredTripsPerPassenger !== undefined
          ? { requiredTripsPerPassenger: input.requiredTripsPerPassenger }
          : {}),
        ...(input.silverThreshold !== undefined ? { silverThreshold: input.silverThreshold } : {}),
        ...(input.silverRewardAmount !== undefined
          ? { silverRewardAmount: input.silverRewardAmount }
          : {}),
        ...(input.goldThreshold !== undefined ? { goldThreshold: input.goldThreshold } : {}),
        ...(input.goldRewardAmount !== undefined
          ? { goldRewardAmount: input.goldRewardAmount }
          : {}),
        ...(input.goldQualificationRate !== undefined
          ? { goldQualificationRate: input.goldQualificationRate }
          : {}),
      },
    });
    await this.auditService.record(
      DRIVER_CAMPAIGN_AUDIT_ACTIONS.CAMPAIGN_CREATED,
      { ...context, userId: adminUserId },
      { resource: 'referral_campaign', resourceId: campaign.id },
    );
    return toReferralCampaignDto(campaign);
  }

  public async updateCampaignRewards(
    campaignId: string,
    input: UpdateCampaignRewardsInput,
    adminUserId: string,
    context: AuditContext,
  ): Promise<ReferralCampaignDto> {
    const campaign = await this.requireCampaign(campaignId);
    if (campaign.status === ReferralCampaignStatus.ENDED) {
      throw new ConflictDomainException('Cannot change reward terms on an ended campaign');
    }
    const updated = await this.prisma.referralCampaign.update({
      where: { id: campaignId },
      data: {
        ...(input.silverRewardAmount !== undefined
          ? { silverRewardAmount: input.silverRewardAmount }
          : {}),
        ...(input.goldRewardAmount !== undefined
          ? { goldRewardAmount: input.goldRewardAmount }
          : {}),
        ...(input.silverThreshold !== undefined ? { silverThreshold: input.silverThreshold } : {}),
        ...(input.goldThreshold !== undefined ? { goldThreshold: input.goldThreshold } : {}),
        ...(input.goldQualificationRate !== undefined
          ? { goldQualificationRate: input.goldQualificationRate }
          : {}),
      },
    });
    await this.auditService.record(
      DRIVER_CAMPAIGN_AUDIT_ACTIONS.CAMPAIGN_UPDATED,
      { ...context, userId: adminUserId },
      { resource: 'referral_campaign', resourceId: campaignId, metadata: { ...input } },
    );
    return toReferralCampaignDto(updated);
  }

  public async pauseCampaign(
    campaignId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<ReferralCampaignDto> {
    const campaign = await this.requireCampaign(campaignId);
    if (campaign.status !== ReferralCampaignStatus.ACTIVE) {
      throw new ConflictDomainException('Only an active campaign can be paused');
    }
    const updated = await this.prisma.referralCampaign.update({
      where: { id: campaignId },
      data: { status: ReferralCampaignStatus.PAUSED },
    });
    await this.auditService.record(
      DRIVER_CAMPAIGN_AUDIT_ACTIONS.CAMPAIGN_PAUSED,
      { ...context, userId: adminUserId },
      { resource: 'referral_campaign', resourceId: campaignId },
    );
    return toReferralCampaignDto(updated);
  }

  public async resumeCampaign(
    campaignId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<ReferralCampaignDto> {
    const campaign = await this.requireCampaign(campaignId);
    if (campaign.status !== ReferralCampaignStatus.PAUSED) {
      throw new ConflictDomainException('Only a paused campaign can be resumed');
    }
    const updated = await this.prisma.referralCampaign.update({
      where: { id: campaignId },
      data: { status: ReferralCampaignStatus.ACTIVE },
    });
    await this.auditService.record(
      DRIVER_CAMPAIGN_AUDIT_ACTIONS.CAMPAIGN_RESUMED,
      { ...context, userId: adminUserId },
      { resource: 'referral_campaign', resourceId: campaignId },
    );
    return toReferralCampaignDto(updated);
  }

  public async listCampaigns(status?: ReferralCampaignStatus): Promise<ReferralCampaignDto[]> {
    const campaigns = await this.prisma.referralCampaign.findMany({
      where: status !== undefined ? { status } : {},
      orderBy: { periodStart: 'desc' },
    });
    return campaigns.map(toReferralCampaignDto);
  }

  /**
   * Driver-facing equivalent of getLeaderboard() below — scoped to the
   * currently active campaign (drivers have no reason to browse past
   * campaigns' rankings) and returns DriverLeaderboardEntryDto rows, which
   * omit the referral code and full name (see the DTO's own doc comment).
   */
  public async getLeaderboardForActiveCampaign(
    requestingDriverId: string,
  ): Promise<DriverLeaderboardEntryDto[]> {
    const campaign = await this.requireActiveCampaign();
    const referrals = await this.prisma.driverReferral.findMany({
      where: { campaignId: campaign.id },
      include: { statistics: true, driver: true },
      orderBy: { statistics: { qualifiedCount: 'desc' } },
    });
    return referrals
      .filter((referral) => referral.statistics)
      .map((referral, index) => {
        const statistics = referral.statistics;
        const tier = statistics
          ? this.computeTier(campaign, statistics)
          : ReferralCampaignTier.NONE;
        return {
          position: index + 1,
          driverName: `${referral.driver.firstName} ${referral.driver.lastName.charAt(0)}.`,
          qualifiedCount: statistics?.qualifiedCount ?? 0,
          currentTier: tier,
          estimatedRewardAmount: this.rewardAmountForTier(campaign, tier),
          isCurrentDriver: referral.driverId === requestingDriverId,
        };
      });
  }

  public async getLeaderboard(campaignId: string): Promise<LeaderboardEntryDto[]> {
    await this.requireCampaign(campaignId);
    const referrals = await this.prisma.driverReferral.findMany({
      where: { campaignId },
      include: { statistics: true, driver: true },
      orderBy: { statistics: { qualifiedCount: 'desc' } },
    });
    return referrals
      .filter((referral) => referral.statistics)
      .map((referral) => ({
        driverId: referral.driverId,
        driverName: `${referral.driver.firstName} ${referral.driver.lastName}`,
        code: referral.code,
        registeredCount: referral.statistics?.registeredCount ?? 0,
        qualifiedCount: referral.statistics?.qualifiedCount ?? 0,
        currentTier: referral.statistics?.currentTier ?? ReferralCampaignTier.NONE,
      }));
  }

  // ---------------------------------------------------------------------
  // Admin: fraud review
  // ---------------------------------------------------------------------

  public async listFraudChecks(
    status?: ReferralFraudCheckStatus,
  ): Promise<ReferralFraudCheckDto[]> {
    const checks = await this.prisma.referralFraudCheck.findMany({
      where: status !== undefined ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });
    return checks.map(toReferralFraudCheckDto);
  }

  public async reviewFraudCheck(
    fraudCheckId: string,
    status: ReferralFraudCheckStatus,
    adminUserId: string,
    context: AuditContext,
  ): Promise<ReferralFraudCheckDto> {
    const check = await this.prisma.referralFraudCheck.findUnique({ where: { id: fraudCheckId } });
    if (!check) {
      throw new NotFoundDomainException('Fraud check not found');
    }
    const updated = await this.prisma.referralFraudCheck.update({
      where: { id: fraudCheckId },
      data: { status, reviewedAt: new Date(), reviewedBy: adminUserId },
    });
    await this.auditService.record(
      DRIVER_CAMPAIGN_AUDIT_ACTIONS.FRAUD_CHECK_REVIEWED,
      { ...context, userId: adminUserId },
      { resource: 'referral_fraud_check', resourceId: fraudCheckId, metadata: { status } },
    );
    return toReferralFraudCheckDto(updated);
  }

  // ---------------------------------------------------------------------
  // Admin: rewards
  // ---------------------------------------------------------------------

  public async listRewards(
    campaignId?: string,
    status?: DriverReferralRewardStatus,
  ): Promise<ReferralRewardDto[]> {
    const rewards = await this.prisma.referralReward.findMany({
      where: {
        ...(campaignId !== undefined ? { campaignId } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rewards.map(toReferralRewardDto);
  }

  public async approveReward(
    rewardId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<ReferralRewardDto> {
    const reward = await this.requireReviewableReward(rewardId);
    const updated = await this.prisma.referralReward.update({
      where: { id: rewardId },
      data: {
        status: DriverReferralRewardStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: adminUserId,
      },
    });
    await this.auditService.record(
      DRIVER_CAMPAIGN_AUDIT_ACTIONS.REWARD_APPROVED,
      { ...context, userId: adminUserId },
      { resource: 'referral_reward', resourceId: rewardId },
    );
    await this.eventBus.emit(
      DOMAIN_EVENTS.DRIVER_REFERRAL_REWARD_APPROVED,
      { userId: reward.driverId, amount: String(reward.amount), tier: reward.tier },
      { actorUserId: adminUserId },
    );
    return toReferralRewardDto(updated);
  }

  public async rejectReward(
    rewardId: string,
    reason: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<ReferralRewardDto> {
    await this.requireReviewableReward(rewardId);
    const updated = await this.prisma.referralReward.update({
      where: { id: rewardId },
      data: {
        status: DriverReferralRewardStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedBy: adminUserId,
        rejectionReason: reason,
      },
    });
    await this.auditService.record(
      DRIVER_CAMPAIGN_AUDIT_ACTIONS.REWARD_REJECTED,
      { ...context, userId: adminUserId },
      { resource: 'referral_reward', resourceId: rewardId, metadata: { reason } },
    );
    return toReferralRewardDto(updated);
  }

  public async payReward(
    rewardId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<ReferralRewardDto> {
    const reward = await this.prisma.referralReward.findUnique({ where: { id: rewardId } });
    if (!reward) {
      throw new NotFoundDomainException('Reward not found');
    }
    if (reward.status !== DriverReferralRewardStatus.APPROVED) {
      throw new ConflictDomainException('Reward must be approved before it can be paid');
    }

    await this.walletService.credit({
      ownerType: WalletOwnerType.DRIVER,
      ownerId: reward.driverId,
      amount: reward.amount,
      referenceType: DRIVER_CAMPAIGN_WALLET_REFERENCE_TYPE,
      referenceId: reward.id,
      description: `Driver referral campaign reward (${reward.tier})`,
      context,
    });

    const updated = await this.prisma.referralReward.update({
      where: { id: rewardId },
      data: { status: DriverReferralRewardStatus.PAID, paidAt: new Date() },
    });
    await this.auditService.record(
      DRIVER_CAMPAIGN_AUDIT_ACTIONS.REWARD_PAID,
      { ...context, userId: adminUserId },
      { resource: 'referral_reward', resourceId: rewardId },
    );
    await this.eventBus.emit(
      DOMAIN_EVENTS.DRIVER_REFERRAL_REWARD_PAID,
      { userId: reward.driverId, amount: String(reward.amount), tier: reward.tier },
      { actorUserId: adminUserId },
    );
    return toReferralRewardDto(updated);
  }

  public async exportCampaignReportCsv(campaignId: string): Promise<string> {
    const campaign = await this.requireCampaign(campaignId);
    const referrals = await this.prisma.driverReferral.findMany({
      where: { campaignId },
      include: { statistics: true, driver: true },
    });
    const rewards = await this.prisma.referralReward.findMany({ where: { campaignId } });
    const rewardByDriverId = new Map(rewards.map((reward) => [reward.driverId, reward]));

    const header = [
      'driver_id',
      'driver_name',
      'code',
      'invites_sent',
      'registered_count',
      'qualified_count',
      'completed_trips',
      'current_tier',
      'reward_status',
      'reward_amount',
    ];
    const rows = referrals.map((referral) => {
      const reward = rewardByDriverId.get(referral.driverId);
      return [
        referral.driverId,
        this.csvEscape(`${referral.driver.firstName} ${referral.driver.lastName}`),
        referral.code,
        String(referral.statistics?.invitesSent ?? 0),
        String(referral.statistics?.registeredCount ?? 0),
        String(referral.statistics?.qualifiedCount ?? 0),
        String(referral.statistics?.completedTrips ?? 0),
        referral.statistics?.currentTier ?? ReferralCampaignTier.NONE,
        reward?.status ?? '',
        reward ? String(Number(reward.amount)) : '',
      ].join(',');
    });

    return [`campaign,${this.csvEscape(campaign.name)}`, header.join(','), ...rows].join('\n');
  }

  // ---------------------------------------------------------------------
  // Sweep (called by DriverCampaignSweepService)
  // ---------------------------------------------------------------------

  public async activateDueCampaigns(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.referralCampaign.updateMany({
      where: {
        status: ReferralCampaignStatus.DRAFT,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      data: { status: ReferralCampaignStatus.ACTIVE },
    });
    return result.count;
  }

  public async endExpiredCampaigns(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.referralCampaign.updateMany({
      where: {
        status: { in: [ReferralCampaignStatus.ACTIVE, ReferralCampaignStatus.PAUSED] },
        periodEnd: { lt: now },
      },
      data: { status: ReferralCampaignStatus.ENDED },
    });
    return result.count;
  }

  // ---------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------

  private async recomputeTier(driverReferralId: string): Promise<void> {
    const referral = await this.prisma.driverReferral.findUnique({
      where: { id: driverReferralId },
      include: { campaign: true, statistics: true },
    });
    if (!referral?.statistics) {
      return;
    }

    const newTier = this.computeTier(referral.campaign, referral.statistics);
    if (newTier === referral.statistics.currentTier) {
      return;
    }

    const previousTier = referral.statistics.currentTier;
    await this.prisma.referralStatistics.update({
      where: { driverReferralId },
      data: { currentTier: newTier },
    });

    if (newTier === ReferralCampaignTier.SILVER && previousTier === ReferralCampaignTier.NONE) {
      await this.eventBus.emit(DOMAIN_EVENTS.DRIVER_REFERRAL_TIER_SILVER_REACHED, {
        userId: referral.driverId,
        campaignId: referral.campaignId,
      });
    }
    if (newTier === ReferralCampaignTier.GOLD && previousTier !== ReferralCampaignTier.GOLD) {
      await this.eventBus.emit(DOMAIN_EVENTS.DRIVER_REFERRAL_TIER_GOLD_REACHED, {
        userId: referral.driverId,
        campaignId: referral.campaignId,
      });
    }

    if (newTier === ReferralCampaignTier.NONE) {
      return;
    }

    await this.prisma.referralReward.upsert({
      where: {
        campaignId_driverId: { campaignId: referral.campaignId, driverId: referral.driverId },
      },
      create: {
        campaignId: referral.campaignId,
        driverId: referral.driverId,
        tier: newTier,
        amount: this.rewardAmountForTier(referral.campaign, newTier),
        qualifiedPassengerCount: referral.statistics.qualifiedCount,
      },
      update: {
        tier: newTier,
        amount: this.rewardAmountForTier(referral.campaign, newTier),
        qualifiedPassengerCount: referral.statistics.qualifiedCount,
      },
    });
  }

  private computeTier(
    campaign: ReferralCampaign,
    statistics: Pick<ReferralStatistics, 'qualifiedCount' | 'registeredCount'>,
  ): ReferralCampaignTier {
    const goldRate =
      statistics.registeredCount > 0 ? statistics.qualifiedCount / statistics.registeredCount : 0;
    if (
      statistics.qualifiedCount >= campaign.goldThreshold &&
      goldRate >= Number(campaign.goldQualificationRate)
    ) {
      return ReferralCampaignTier.GOLD;
    }
    if (statistics.qualifiedCount >= campaign.silverThreshold) {
      return ReferralCampaignTier.SILVER;
    }
    return ReferralCampaignTier.NONE;
  }

  private rewardAmountForTier(campaign: ReferralCampaign, tier: ReferralCampaignTier): number {
    if (tier === ReferralCampaignTier.GOLD) {
      return Number(campaign.goldRewardAmount);
    }
    if (tier === ReferralCampaignTier.SILVER) {
      return Number(campaign.silverRewardAmount);
    }
    return 0;
  }

  private async getRewardHistory(driverId: string): Promise<ReferralRewardDto[]> {
    const rewards = await this.prisma.referralReward.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
    });
    return rewards.map(toReferralRewardDto);
  }

  private async recordFraudCheck(
    passengerReferralId: string | null,
    driverReferralId: string | null,
    checkType: ReferralFraudCheckType,
    status: ReferralFraudCheckStatus,
    details: string,
  ): Promise<void> {
    await this.prisma.referralFraudCheck.create({
      data: {
        ...(passengerReferralId !== null ? { passengerReferralId } : {}),
        ...(driverReferralId !== null ? { driverReferralId } : {}),
        checkType,
        status,
        details,
      },
    });
  }

  private async codeExists(code: string): Promise<boolean> {
    const [driverCode, customerCode] = await Promise.all([
      this.prisma.driverReferral.findUnique({ where: { code } }),
      this.prisma.referral.findUnique({ where: { code } }),
    ]);
    return driverCode !== null || customerCode !== null;
  }

  private async requireEligibleDriver(driverId: string): Promise<void> {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId: driverId } });
    const eligible =
      profile?.status === DriverStatus.APPROVED &&
      profile.isApproved &&
      profile.suspendedAt === null &&
      profile.deletedAt === null;
    if (!eligible) {
      throw new ValidationDomainException(
        'Only active, verified drivers can participate in the referral campaign',
      );
    }
  }

  private async findActiveCampaign(): Promise<ReferralCampaign | null> {
    return await this.prisma.referralCampaign.findFirst({
      where: { status: ReferralCampaignStatus.ACTIVE },
      orderBy: { periodStart: 'desc' },
    });
  }

  private async requireActiveCampaign(): Promise<ReferralCampaign> {
    const campaign = await this.findActiveCampaign();
    if (!campaign) {
      throw new NotFoundDomainException('No active driver referral campaign right now');
    }
    return campaign;
  }

  private async requireCampaign(campaignId: string): Promise<ReferralCampaign> {
    const campaign = await this.prisma.referralCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundDomainException('Referral campaign not found');
    }
    return campaign;
  }

  /**
   * A reward is only reviewable once its campaign has ENDED — the tier can
   * still improve mid-month (Silver -> Gold), and approving early risks
   * having to claw back a smaller approved amount.
   */
  private async requireReviewableReward(rewardId: string): Promise<ReferralReward> {
    const reward = await this.prisma.referralReward.findUnique({
      where: { id: rewardId },
      include: { campaign: true },
    });
    if (!reward) {
      throw new NotFoundDomainException('Reward not found');
    }
    if (reward.status !== DriverReferralRewardStatus.PENDING) {
      throw new ConflictDomainException('Only a pending reward can be approved or rejected');
    }
    if (reward.campaign.status !== ReferralCampaignStatus.ENDED) {
      throw new ConflictDomainException(
        'Reward cannot be reviewed until its campaign has ended — the tier may still change',
      );
    }
    return reward;
  }

  private secondsUntil(date: Date): number {
    return Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
  }

  private csvEscape(value: string): string {
    return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
  }
}
