import { Injectable } from '@nestjs/common';
import {
  BusinessVerificationStatus,
  CustomerKycStatus,
  DriverStatus,
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
 * | Driver   | Approved by DrippleX, and a first completed trip              |
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
      case ReferralRefereeType.DRIVER:
        return await this.evaluateDriver(refereeUserId, programme);
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

  /**
   * DrippleX having approved them, and a first completed trip.
   *
   * The same shape as the other three, for the same reason: signing up as a
   * driver proves nothing. Anyone can start an application, and an application
   * that stalls at PENDING costs DrippleX the reward and returns nothing.
   * `DriverStatus.APPROVED` is DrippleX deciding this person may drive, and the
   * first COMPLETED ride is the first fare the platform earned from — which is
   * what the reward is paid out of.
   *
   * Approval alone is deliberately not enough. A driver can be approved and
   * never switch on, and that is the exact case the hold and the milestone
   * exist to keep off the payroll.
   *
   * Rides are counted by `driverId` on COMPLETED rides only — a cancelled or
   * abandoned trip is not a fare. `requireKycVerified` reads `DriverKyc`, never
   * `CustomerKyc`: they are separate models by founder decision and a driver who
   * verified as a customer has not verified as a driver.
   */
  private async evaluateDriver(
    refereeUserId: string,
    programme: ReferralProgramme,
  ): Promise<ReferralQualification> {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId: refereeUserId },
      select: { status: true },
    });
    if (profile === null) {
      return pending('the referred driver has not started a driver application');
    }
    if (profile.status !== DriverStatus.APPROVED) {
      return pending('the referred driver has not been approved by DrippleX');
    }

    if (programme.requireKycVerified) {
      const verified = await this.prisma.driverKyc.count({
        where: { driverId: refereeUserId, verificationStatus: KycVerificationStatus.VERIFIED },
      });
      if (verified === 0) {
        return pending('the referred driver has no verified KYC document');
      }
    }

    const trips = await this.prisma.ride.count({
      where: { driverId: refereeUserId, status: RideStatus.COMPLETED },
    });
    if (trips === 0) {
      return pending('the referred driver has not completed their first trip');
    }
    return QUALIFIED;
  }
}
