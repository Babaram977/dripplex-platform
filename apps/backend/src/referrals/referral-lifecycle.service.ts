import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  ReferralOwnerType,
  ReferralRedemptionStatus,
  ReferralRefereeType,
  ReferralRejectionReason,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import { ReferralAntiAbuseService } from './referral-anti-abuse.service';
import { ReferralQualificationService } from './referral-qualification.service';
import {
  REFERRAL_AUDIT_ACTIONS,
  REFERRAL_WALLET_REFERENCE_TYPES,
  REFERRAL_SWEEP_BATCH_SIZE,
} from './referral.constants';

import type { ReferralProgramme, ReferralRedemption } from '@prisma/client';

/**
 * Where a referrer's reward lands, by the persona they held when they were
 * issued the code.
 *
 * Read off the referral rather than from the referrer's profiles, so a customer
 * who later starts driving does not have old rewards re-filed under the new
 * persona.
 */
const REFERRER_WALLETS = {
  [ReferralOwnerType.DRIVER]: WalletOwnerType.DRIVER,
  [ReferralOwnerType.RIDER]: WalletOwnerType.RIDER,
  [ReferralOwnerType.CUSTOMER]: WalletOwnerType.CUSTOMER,
  [ReferralOwnerType.MERCHANT]: WalletOwnerType.MERCHANT,
  // A fleet owner has no fleet wallet — a fleet's money reaches it as an
  // Ops-approved settlement receivable for work its riders did. A referral is
  // not that: it is the owner's own marketing, earned by the person, so it is
  // paid into the personal wallet they can actually withdraw from.
  [ReferralOwnerType.FLEET_OWNER]: WalletOwnerType.CUSTOMER,
} as const;

export interface ReferralProgrammeDto {
  refereeType: ReferralRefereeType;
  referrerRewardAmount: number;
  refereeRewardAmount: number;
  holdDays: number;
  qualificationWindowDays: number;
  requireKycVerified: boolean;
  active: boolean;
  updatedAt: string;
}

type RedemptionWithReferral = ReferralRedemption & {
  referral: { userId: string; ownerType: ReferralOwnerType };
};

/**
 * DPX-REFERRAL-003 — a referral from redeemed to paid, and back again if it has
 * to be.
 *
 * The lifecycle exists because the two-state version could not say the one
 * thing that makes referral fraud survivable: *this referral has earned its
 * reward and the money has not moved yet*. Everything here hangs off that gap.
 *
 * ```
 *   PENDING ──(milestone met, screening clean)──▶ QUALIFIED
 *      │                                             │
 *      │ (window closed)                             │ (hold elapsed)
 *      ▼                                             ▼
 *   EXPIRED                                       APPROVED
 *      ▲                                             │
 *      │                                             │ (wallets credited)
 *   REJECTED ◀──(screening or Operations)──┬─────────▶ PAID ──▶ REVERSED
 * ```
 *
 * Two properties matter more than the states themselves:
 *
 * - **Amounts are snapshotted at qualification.** Operations re-pricing a
 *   programme must never rewrite what somebody already earned.
 * - **Payment is idempotent at the wallet.** Both credits are keyed on the
 *   redemption id, so a sweep that runs twice, or a process that dies between
 *   the two credits, pays exactly once.
 */
@Injectable()
export class ReferralLifecycleService {
  private readonly logger = new Logger(ReferralLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: DomainEventBus,
    private readonly walletService: WalletService,
    private readonly qualification: ReferralQualificationService,
    private readonly antiAbuse: ReferralAntiAbuseService,
  ) {}

  // ── Programmes ────────────────────────────────────────────────────────────

  public async listProgrammes(): Promise<ReferralProgrammeDto[]> {
    const programmes = await this.prisma.referralProgramme.findMany({
      orderBy: { refereeType: 'asc' },
    });
    return programmes.map(toProgrammeDto);
  }

  /**
   * Returns null when no programme row exists for this referee type. Null is a
   * refusal to guess: without a programme there is no agreed amount, and
   * inventing one is inventing money.
   */
  public async programmeFor(refereeType: ReferralRefereeType): Promise<ReferralProgramme | null> {
    return await this.prisma.referralProgramme.findUnique({ where: { refereeType } });
  }

  public async updateProgramme(
    refereeType: ReferralRefereeType,
    input: {
      referrerRewardAmount?: number;
      refereeRewardAmount?: number;
      holdDays?: number;
      qualificationWindowDays?: number;
      requireKycVerified?: boolean;
      active?: boolean;
    },
    adminUserId: string,
    context: AuditContext = {},
  ): Promise<ReferralProgrammeDto> {
    assertAmount('referrerRewardAmount', input.referrerRewardAmount);
    assertAmount('refereeRewardAmount', input.refereeRewardAmount);
    assertWholeDays('holdDays', input.holdDays);
    assertWholeDays('qualificationWindowDays', input.qualificationWindowDays);
    if (input.qualificationWindowDays !== undefined && input.qualificationWindowDays === 0) {
      throw new ValidationDomainException(
        'A qualification window of zero days would expire every referral the moment it was redeemed',
      );
    }

    const before = await this.prisma.referralProgramme.findUnique({ where: { refereeType } });
    if (before === null) {
      throw new NotFoundDomainException(`There is no ${refereeType} referral programme`);
    }

    const updated = await this.prisma.referralProgramme.update({
      where: { refereeType },
      data: {
        ...(input.referrerRewardAmount !== undefined
          ? { referrerRewardAmount: new Prisma.Decimal(input.referrerRewardAmount) }
          : {}),
        ...(input.refereeRewardAmount !== undefined
          ? { refereeRewardAmount: new Prisma.Decimal(input.refereeRewardAmount) }
          : {}),
        ...(input.holdDays !== undefined ? { holdDays: input.holdDays } : {}),
        ...(input.qualificationWindowDays !== undefined
          ? { qualificationWindowDays: input.qualificationWindowDays }
          : {}),
        ...(input.requireKycVerified !== undefined
          ? { requireKycVerified: input.requireKycVerified }
          : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        updatedBy: adminUserId,
      },
    });

    await this.auditService.record(
      REFERRAL_AUDIT_ACTIONS.PROGRAMME_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'referral_programme',
        resourceId: updated.id,
        metadata: {
          refereeType,
          previousReferrerReward: Number(before.referrerRewardAmount),
          newReferrerReward: Number(updated.referrerRewardAmount),
          previousRefereeReward: Number(before.refereeRewardAmount),
          newRefereeReward: Number(updated.refereeRewardAmount),
          previousHoldDays: before.holdDays,
          newHoldDays: updated.holdDays,
        },
      },
    );

    return toProgrammeDto(updated);
  }

  // ── The lifecycle ─────────────────────────────────────────────────────────

  /**
   * Move one redemption as far along as it can go right now.
   *
   * Safe to call as often as anything likes: every transition is guarded on the
   * state it moves out of, so a caller racing the sweep loses harmlessly rather
   * than paying twice.
   */
  public async advance(redemptionId: string): Promise<ReferralRedemptionStatus> {
    const redemption = await this.prisma.referralRedemption.findUnique({
      where: { id: redemptionId },
      include: { referral: { select: { userId: true, ownerType: true } } },
    });
    if (redemption === null) {
      throw new NotFoundDomainException('That referral redemption does not exist');
    }
    return await this.advanceRecord(redemption, new Date());
  }

  private async advanceRecord(
    redemption: RedemptionWithReferral,
    now: Date,
  ): Promise<ReferralRedemptionStatus> {
    if (redemption.status === ReferralRedemptionStatus.PENDING) {
      if (redemption.expiresAt !== null && redemption.expiresAt <= now) {
        return await this.expire(redemption);
      }
      const qualified = await this.tryQualify(redemption, now);
      if (qualified === null) {
        return redemption.status;
      }
      redemption = qualified;
    }

    if (redemption.status === ReferralRedemptionStatus.QUALIFIED) {
      const approved = await this.tryApprove(redemption, now);
      if (approved === null) {
        return redemption.status;
      }
      redemption = approved;
    }

    if (redemption.status === ReferralRedemptionStatus.APPROVED) {
      return await this.pay(redemption);
    }

    return redemption.status;
  }

  /**
   * Milestone, then screening, then the amounts.
   *
   * Screening runs *after* the milestone rather than before it because that is
   * the first moment there is anything to screen. It runs *before* the
   * snapshot because a referral that is refused never had an amount.
   */
  private async tryQualify(
    redemption: RedemptionWithReferral,
    now: Date,
  ): Promise<RedemptionWithReferral | null> {
    const programme = await this.programmeFor(redemption.refereeType);
    if (programme === null) {
      return null;
    }
    // A paused programme stops qualifying new referrals. Ones already qualified
    // keep the amounts snapshotted on them and still pay: pausing decides what
    // DrippleX takes on, not what it walks away from owing.
    if (!programme.active) {
      return null;
    }

    const milestone = await this.qualification.evaluate(redemption.refereeUserId, programme);
    if (!milestone.qualified) {
      return null;
    }

    const screening = await this.antiAbuse.screen(
      redemption.referral.userId,
      redemption.refereeUserId,
    );
    if (screening.reject !== null) {
      await this.rejectRecord(redemption, screening.reject, null, null, now);
      return null;
    }

    const updated = await this.prisma.referralRedemption.updateMany({
      where: { id: redemption.id, status: ReferralRedemptionStatus.PENDING },
      data: {
        status: ReferralRedemptionStatus.QUALIFIED,
        qualifiedAt: now,
        programmeId: programme.id,
        referrerRewardAmount: programme.referrerRewardAmount,
        refereeRewardAmount: programme.refereeRewardAmount,
        flaggedReason: screening.flag,
      },
    });
    if (updated.count !== 1) {
      return null;
    }

    await this.auditService.record(
      REFERRAL_AUDIT_ACTIONS.QUALIFIED,
      { userId: redemption.refereeUserId },
      {
        resource: 'referral_redemption',
        resourceId: redemption.id,
        metadata: {
          refereeType: redemption.refereeType,
          holdDays: programme.holdDays,
          flaggedReason: screening.flag,
        },
      },
    );

    return {
      ...redemption,
      status: ReferralRedemptionStatus.QUALIFIED,
      qualifiedAt: now,
      programmeId: programme.id,
      referrerRewardAmount: programme.referrerRewardAmount,
      refereeRewardAmount: programme.refereeRewardAmount,
      flaggedReason: screening.flag,
    };
  }

  /**
   * The hold.
   *
   * Founder-locked reason it exists at all: a referral collected through a fake
   * account is usually visible inside a week, and money already withdrawn
   * cannot be clawed back. A programme with `holdDays: 0` approves immediately,
   * which is what the platform did before this shipped.
   *
   * A flagged referral is **not** approved automatically. The flag exists to be
   * looked at, and a hold that releases a flagged referral on a timer has not
   * held anything.
   */
  private async tryApprove(
    redemption: RedemptionWithReferral,
    now: Date,
  ): Promise<RedemptionWithReferral | null> {
    if (redemption.flaggedReason !== null) {
      return null;
    }
    const programme = await this.programmeOf(redemption);
    if (programme === null) {
      return null;
    }
    if (redemption.qualifiedAt === null) {
      return null;
    }
    if (releaseAt(redemption.qualifiedAt, programme.holdDays) > now) {
      return null;
    }

    const updated = await this.prisma.referralRedemption.updateMany({
      where: { id: redemption.id, status: ReferralRedemptionStatus.QUALIFIED },
      data: { status: ReferralRedemptionStatus.APPROVED, approvedAt: now },
    });
    if (updated.count !== 1) {
      return null;
    }
    return { ...redemption, status: ReferralRedemptionStatus.APPROVED, approvedAt: now };
  }

  /**
   * Both credits, then the status.
   *
   * In that order deliberately. Each credit is keyed on the redemption id, so a
   * crash between them replays harmlessly and neither side is paid twice; a
   * status written first and a credit that then failed would be a referral the
   * platform believes it has paid and has not.
   */
  private async pay(redemption: RedemptionWithReferral): Promise<ReferralRedemptionStatus> {
    const referrerAmount = Number(redemption.referrerRewardAmount ?? 0);
    const refereeAmount = Number(redemption.refereeRewardAmount ?? 0);

    if (referrerAmount > 0) {
      await this.walletService.credit({
        ownerType: REFERRER_WALLETS[redemption.referral.ownerType],
        ownerId: redemption.referral.userId,
        amount: referrerAmount,
        referenceType: REFERRAL_WALLET_REFERENCE_TYPES.REFERRER_REWARD,
        referenceId: redemption.id,
        description: 'Referral reward — someone you referred reached their first milestone',
      });
    }
    // Zero is a real setting, not a missing one: a fleet referral pays the
    // referrer only. The wallet refuses a ₦0 movement by design, so skip it.
    if (refereeAmount > 0) {
      await this.walletService.credit({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: redemption.refereeUserId,
        amount: refereeAmount,
        referenceType: REFERRAL_WALLET_REFERENCE_TYPES.REFEREE_REWARD,
        referenceId: redemption.id,
        description: 'Referral reward — welcome bonus for using a referral code',
      });
    }

    const paidAt = new Date();
    await this.prisma.referralRedemption.updateMany({
      where: { id: redemption.id, status: ReferralRedemptionStatus.APPROVED },
      data: { status: ReferralRedemptionStatus.PAID, paidAt },
    });

    await this.auditService.record(
      REFERRAL_AUDIT_ACTIONS.REWARDED,
      { userId: redemption.refereeUserId },
      {
        resource: 'referral_redemption',
        resourceId: redemption.id,
        metadata: {
          referrerId: redemption.referral.userId,
          refereeId: redemption.refereeUserId,
          referrerAmount,
          refereeAmount,
        },
      },
    );

    if (referrerAmount > 0) {
      await this.eventBus.emit(
        DOMAIN_EVENTS.REFERRAL_REWARDED,
        {
          userId: redemption.referral.userId,
          amount: String(referrerAmount),
          role: 'referrer',
        },
        { actorUserId: redemption.refereeUserId },
      );
    }
    if (refereeAmount > 0) {
      await this.eventBus.emit(
        DOMAIN_EVENTS.REFERRAL_REWARDED,
        { userId: redemption.refereeUserId, amount: String(refereeAmount), role: 'referee' },
        { actorUserId: redemption.refereeUserId },
      );
    }

    return ReferralRedemptionStatus.PAID;
  }

  private async expire(redemption: RedemptionWithReferral): Promise<ReferralRedemptionStatus> {
    await this.prisma.referralRedemption.updateMany({
      where: { id: redemption.id, status: ReferralRedemptionStatus.PENDING },
      data: { status: ReferralRedemptionStatus.EXPIRED },
    });
    return ReferralRedemptionStatus.EXPIRED;
  }

  // ── Operations overrides ──────────────────────────────────────────────────

  /**
   * Refuse a referral that has not been paid.
   *
   * Deliberately cannot touch a PAID row: taking money back is `reverse`, which
   * moves it rather than only relabelling the record. A "rejected" row whose
   * credits are still sitting in two wallets is a lie the ledger would not
   * agree with.
   */
  public async reject(
    redemptionId: string,
    reason: ReferralRejectionReason,
    note: string | null,
    adminUserId: string,
    context: AuditContext = {},
  ): Promise<ReferralRedemptionStatus> {
    const redemption = await this.requireRedemption(redemptionId);
    if (
      redemption.status === ReferralRedemptionStatus.PAID ||
      redemption.status === ReferralRedemptionStatus.REVERSED
    ) {
      throw new ValidationDomainException(
        'That referral has already been paid — reverse it instead, which moves the money back',
      );
    }
    if (redemption.status === ReferralRedemptionStatus.REJECTED) {
      return redemption.status;
    }

    await this.rejectRecord(redemption, reason, note, adminUserId, new Date());
    await this.auditService.record(
      REFERRAL_AUDIT_ACTIONS.REJECTED,
      { ...context, userId: adminUserId },
      {
        resource: 'referral_redemption',
        resourceId: redemptionId,
        metadata: { reason, previousStatus: redemption.status },
      },
    );
    return ReferralRedemptionStatus.REJECTED;
  }

  /**
   * Release a flagged or still-held referral early.
   *
   * The counterpart to the flag: a shared device usually means a household, and
   * somebody has to be able to say so. Recorded against the operator who said
   * it, because overriding a fraud control is exactly the action an audit trail
   * exists for.
   */
  public async approve(
    redemptionId: string,
    note: string | null,
    adminUserId: string,
    context: AuditContext = {},
  ): Promise<ReferralRedemptionStatus> {
    const redemption = await this.requireRedemption(redemptionId);
    if (redemption.status !== ReferralRedemptionStatus.QUALIFIED) {
      throw new ValidationDomainException(
        `Only a qualified referral can be released early — this one is ${redemption.status}`,
      );
    }

    await this.prisma.referralRedemption.updateMany({
      where: { id: redemptionId, status: ReferralRedemptionStatus.QUALIFIED },
      data: {
        status: ReferralRedemptionStatus.APPROVED,
        approvedAt: new Date(),
        flaggedReason: null,
        reviewedBy: adminUserId,
        ...(note === null ? {} : { reviewNote: note }),
      },
    });

    await this.auditService.record(
      REFERRAL_AUDIT_ACTIONS.APPROVED,
      { ...context, userId: adminUserId },
      {
        resource: 'referral_redemption',
        resourceId: redemptionId,
        metadata: { clearedFlag: redemption.flaggedReason },
      },
    );

    return await this.advance(redemptionId);
  }

  /**
   * Take a paid reward back.
   *
   * Both debits are keyed on the redemption id the same way the credits were,
   * so a reversal replays without double-debiting.
   *
   * It can fail, and failing is the right outcome: the wallet refuses a debit
   * that would overdraw, so a referrer who has already spent the reward cannot
   * be reversed. That is a real limit of clawing money back after it has moved,
   * and the hold is what exists to stop it happening — not something to paper
   * over by letting a wallet go negative.
   */
  public async reverse(
    redemptionId: string,
    reason: string,
    adminUserId: string,
    context: AuditContext = {},
  ): Promise<ReferralRedemptionStatus> {
    const redemption = await this.requireRedemption(redemptionId);
    if (redemption.status === ReferralRedemptionStatus.REVERSED) {
      return redemption.status;
    }
    if (redemption.status !== ReferralRedemptionStatus.PAID) {
      throw new ValidationDomainException(
        `Only a paid referral can be reversed — this one is ${redemption.status}`,
      );
    }

    const referrerAmount = Number(redemption.referrerRewardAmount ?? 0);
    const refereeAmount = Number(redemption.refereeRewardAmount ?? 0);

    if (referrerAmount > 0) {
      await this.walletService.debit({
        ownerType: REFERRER_WALLETS[redemption.referral.ownerType],
        ownerId: redemption.referral.userId,
        amount: referrerAmount,
        referenceType: REFERRAL_WALLET_REFERENCE_TYPES.REFERRER_REVERSAL,
        referenceId: redemption.id,
        description: 'Referral reward reversed',
      });
    }
    if (refereeAmount > 0) {
      await this.walletService.debit({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: redemption.refereeUserId,
        amount: refereeAmount,
        referenceType: REFERRAL_WALLET_REFERENCE_TYPES.REFEREE_REVERSAL,
        referenceId: redemption.id,
        description: 'Referral welcome bonus reversed',
      });
    }

    await this.prisma.referralRedemption.updateMany({
      where: { id: redemptionId, status: ReferralRedemptionStatus.PAID },
      data: {
        status: ReferralRedemptionStatus.REVERSED,
        reversedAt: new Date(),
        reviewedBy: adminUserId,
        reviewNote: reason.slice(0, 500),
      },
    });

    await this.auditService.record(
      REFERRAL_AUDIT_ACTIONS.REVERSED,
      { ...context, userId: adminUserId },
      {
        resource: 'referral_redemption',
        resourceId: redemptionId,
        metadata: { referrerAmount, refereeAmount, reason },
      },
    );

    return ReferralRedemptionStatus.REVERSED;
  }

  // ── The sweep ─────────────────────────────────────────────────────────────

  /**
   * Everything that is waiting on time rather than on a person.
   *
   * One pass over the redemptions that could move: those still waiting to
   * qualify, and those whose hold may have elapsed. A failure on one redemption
   * is logged and the rest of the batch continues — one referral that cannot be
   * paid must not stop the other two hundred.
   */
  public async sweep(now: Date = new Date()): Promise<{
    qualified: number;
    paid: number;
    expired: number;
  }> {
    const outcome = { qualified: 0, paid: 0, expired: 0 };

    const waiting = await this.prisma.referralRedemption.findMany({
      where: {
        status: { in: [ReferralRedemptionStatus.PENDING, ReferralRedemptionStatus.QUALIFIED] },
      },
      include: { referral: { select: { userId: true, ownerType: true } } },
      orderBy: { createdAt: 'asc' },
      take: REFERRAL_SWEEP_BATCH_SIZE,
    });

    for (const redemption of waiting) {
      try {
        const status = await this.advanceRecord(redemption, now);
        if (status === ReferralRedemptionStatus.QUALIFIED) {
          outcome.qualified += 1;
        } else if (status === ReferralRedemptionStatus.PAID) {
          outcome.paid += 1;
        } else if (status === ReferralRedemptionStatus.EXPIRED) {
          outcome.expired += 1;
        }
      } catch (error) {
        this.logger.error(
          `Referral ${redemption.id} could not be advanced: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    return outcome;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async requireRedemption(redemptionId: string): Promise<RedemptionWithReferral> {
    const redemption = await this.prisma.referralRedemption.findUnique({
      where: { id: redemptionId },
      include: { referral: { select: { userId: true, ownerType: true } } },
    });
    if (redemption === null) {
      throw new NotFoundDomainException('That referral redemption does not exist');
    }
    return redemption;
  }

  private async programmeOf(redemption: RedemptionWithReferral): Promise<ReferralProgramme | null> {
    if (redemption.programmeId !== null) {
      return await this.prisma.referralProgramme.findUnique({
        where: { id: redemption.programmeId },
      });
    }
    return await this.programmeFor(redemption.refereeType);
  }

  private async rejectRecord(
    redemption: RedemptionWithReferral,
    reason: ReferralRejectionReason,
    note: string | null,
    adminUserId: string | null,
    now: Date,
  ): Promise<void> {
    await this.prisma.referralRedemption.updateMany({
      where: { id: redemption.id, status: { not: ReferralRedemptionStatus.PAID } },
      data: {
        status: ReferralRedemptionStatus.REJECTED,
        rejectedAt: now,
        rejectionReason: reason,
        ...(note === null ? {} : { reviewNote: note.slice(0, 500) }),
        ...(adminUserId === null ? {} : { reviewedBy: adminUserId }),
      },
    });
  }
}

/** Whole days added to a timestamp. */
export function releaseAt(qualifiedAt: Date, holdDays: number): Date {
  return new Date(qualifiedAt.getTime() + holdDays * 24 * 60 * 60 * 1000);
}

function toProgrammeDto(programme: ReferralProgramme): ReferralProgrammeDto {
  return {
    refereeType: programme.refereeType,
    referrerRewardAmount: Number(programme.referrerRewardAmount),
    refereeRewardAmount: Number(programme.refereeRewardAmount),
    holdDays: programme.holdDays,
    qualificationWindowDays: programme.qualificationWindowDays,
    requireKycVerified: programme.requireKycVerified,
    active: programme.active,
    updatedAt: programme.updatedAt.toISOString(),
  };
}

function assertAmount(field: string, value: number | undefined): void {
  if (value === undefined) {
    return;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationDomainException(`${field} must be zero or a positive amount in naira`);
  }
}

function assertWholeDays(field: string, value: number | undefined): void {
  if (value === undefined) {
    return;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationDomainException(`${field} must be a whole number of days, zero or more`);
  }
}
