import { Injectable } from '@nestjs/common';
import {
  BusinessVerificationStatus,
  CustomerKycStatus,
  FleetMemberStatus,
  FleetStatus,
  KycVerificationStatus,
  OrderStatus,
  ReferralRefereeType,
  RideStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { ReferralProgramme } from '@prisma/client';

/**
 * Why a referral has not qualified yet, in the referee's own terms.
 *
 * Returned rather than logged because it is the honest answer to "where is my
 * ₦350?" — a referrer whose friend signed up three weeks ago is owed a reason,
 * and "pending" is not one.
 */
export interface ReferralQualification {
  qualified: boolean;
  /** Null once qualified. */
  outstanding: string | null;
}

const QUALIFIED: ReferralQualification = { qualified: true, outstanding: null };

function pending(outstanding: string): ReferralQualification {
  return { qualified: false, outstanding };
}

/**
 * DPX-REFERRAL-003 — has the referred party done enough to be worth paying for?
 *
 * Nora's specification, 2026-09-11, gives one milestone per kind of referee:
 *
 * | Referee  | Milestone                                                    |
 * | -------- | ------------------------------------------------------------ |
 * | Customer | A first qualifying paid transaction                           |
 * | Merchant | Verification, a bank account on file, and a first order       |
 * | Fleet    | Riders attached, a bank account on file, and activation       |
 *
 * Each of them is the point at which the referral has produced something
 * DrippleX earns from, which is what the reward is being paid out of. Signup is
 * deliberately not on the list: an account that never transacts costs DrippleX
 * the reward and returns nothing, and paying on signup alone is the oldest
 * free-money fraud there is.
 *
 * Milestones are evaluated by **asking the database what is true now** rather
 * than by listening for the moment it became true. A referral that was signed
 * up before its programme existed still qualifies the first time the sweep
 * looks at it, an event lost to a restart costs nothing, and there is one set
 * of rules rather than one per event emitter.
 */
@Injectable()
export class ReferralQualificationService {
  constructor(private readonly prisma: PrismaService) {}

  public async evaluate(
    refereeUserId: string,
    programme: ReferralProgramme,
  ): Promise<ReferralQualification> {
    switch (programme.refereeType) {
      case ReferralRefereeType.CUSTOMER:
        return await this.evaluateCustomer(refereeUserId, programme);
      case ReferralRefereeType.MERCHANT:
        return await this.evaluateMerchant(refereeUserId, programme);
      case ReferralRefereeType.FLEET:
        return await this.evaluateFleet(refereeUserId, programme);
    }
  }

  /**
   * A first qualifying paid transaction.
   *
   * Both a completed ride and a completed marketplace order count. Before this
   * only a ride did, which meant a referred customer who orders food every week
   * and has never taken a ride left their referrer unpaid forever — the
   * referral did exactly what DrippleX wanted and paid nobody.
   */
  private async evaluateCustomer(
    refereeUserId: string,
    programme: ReferralProgramme,
  ): Promise<ReferralQualification> {
    if (programme.requireKycVerified) {
      const verified = await this.prisma.customerKyc.count({
        where: { userId: refereeUserId, status: CustomerKycStatus.VERIFIED },
      });
      if (verified === 0) {
        return pending('the referred customer has not completed identity verification');
      }
    }

    const [rides, orders] = await Promise.all([
      this.prisma.ride.count({
        where: { customerId: refereeUserId, status: RideStatus.COMPLETED },
      }),
      this.prisma.order.count({
        where: { customerId: refereeUserId, status: OrderStatus.COMPLETED },
      }),
    ]);
    if (rides === 0 && orders === 0) {
      return pending('the referred customer has not completed their first ride or order');
    }
    return QUALIFIED;
  }

  /**
   * Verification, a bank account, and a first order.
   *
   * All three together, because each on its own is reachable without ever
   * trading: a shop can be registered and verified and never open, and a bank
   * account can be added to an empty one. The first completed order is what
   * makes it a merchant.
   */
  private async evaluateMerchant(
    refereeUserId: string,
    programme: ReferralProgramme,
  ): Promise<ReferralQualification> {
    const business = await this.prisma.business.findFirst({
      where: { merchantId: refereeUserId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, verificationStatus: true },
    });
    if (business === null) {
      return pending('the referred merchant has not registered a business');
    }
    if (business.verificationStatus !== BusinessVerificationStatus.VERIFIED) {
      return pending('the referred merchant has not been verified by DrippleX');
    }

    if (programme.requireKycVerified) {
      const verified = await this.prisma.merchantKyc.count({
        where: { merchantId: refereeUserId, verificationStatus: KycVerificationStatus.VERIFIED },
      });
      if (verified === 0) {
        return pending('the referred merchant has no verified KYC document');
      }
    }

    const bankAccounts = await this.prisma.bankAccount.count({
      where: { merchantId: refereeUserId },
    });
    if (bankAccounts === 0) {
      return pending('the referred merchant has no bank account on file');
    }

    const orders = await this.prisma.order.count({
      where: { merchantId: refereeUserId, status: OrderStatus.COMPLETED },
    });
    if (orders === 0) {
      return pending('the referred merchant has not completed their first order');
    }
    return QUALIFIED;
  }

  /**
   * Riders attached, a bank account, and Operations having activated the fleet.
   *
   * The activation check is the one that matters: a fleet registers itself
   * online and is issued its DX number immediately, so registration proves
   * nothing. `FleetStatus.ACTIVE` is DrippleX deciding the company is real.
   *
   * Members are counted ACTIVE only. A rider who typed the fleet's DX number
   * during onboarding is PENDING until the owner confirms them, and anybody can
   * type any number — counting those would let a fleet qualify on riders it
   * never employed.
   */
  private async evaluateFleet(
    refereeUserId: string,
    programme: ReferralProgramme,
  ): Promise<ReferralQualification> {
    const fleet = await this.prisma.fleet.findFirst({
      where: { ownerId: refereeUserId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (fleet === null) {
      return pending('the referred owner has not registered a fleet');
    }
    if (fleet.status !== FleetStatus.ACTIVE) {
      return pending('the referred fleet has not been activated by DrippleX');
    }

    if (programme.requireKycVerified) {
      const verified = await this.prisma.customerKyc.count({
        where: { userId: refereeUserId, status: CustomerKycStatus.VERIFIED },
      });
      if (verified === 0) {
        return pending('the referred fleet owner has not completed identity verification');
      }
    }

    const bankAccounts = await this.prisma.fleetBankAccount.count({
      where: { fleetId: fleet.id },
    });
    if (bankAccounts === 0) {
      return pending('the referred fleet has no bank account on file');
    }

    const members = await this.prisma.fleetMember.count({
      where: { fleetId: fleet.id, status: FleetMemberStatus.ACTIVE, removedAt: null },
    });
    if (members === 0) {
      return pending('the referred fleet has no active riders or drivers attached');
    }
    return QUALIFIED;
  }
}
