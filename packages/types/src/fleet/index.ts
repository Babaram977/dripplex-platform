import type { DeliveryStatus } from '../delivery/index.js';
import type { RideStatus } from '../ride/index.js';

/**
 * DPX-FLEET — a company that supplies riders and drivers to DrippleX.
 *
 * Founder decision, 2026-08-30, modelled on how Talabat works: the fleet owns
 * the bikes and cars, employs the riders and agrees their pay privately.
 * DrippleX supplies the demand and charges the fleet a percentage of the
 * delivery fees its members earned — never the basket the merchant sold.
 *
 * Who may ride is not delegated. KYC, identity verification and onboarding
 * stay with Operations for fleet riders exactly as for everyone else.
 */
/**
 * `PENDING_APPROVAL` is a fleet an owner registered online: its DX number is
 * issued so they can give it to their riders, but it is not a billable
 * DrippleX partner until Operations approves it. `REJECTED` is terminal.
 */
export type FleetStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
export type FleetMemberRole = 'RIDER' | 'DRIVER';
/**
 * `PENDING` is a rider who quoted this fleet's number at onboarding and whom
 * the owner has not confirmed. Not a member: not dispatched as one, not
 * counted, not billed.
 */
export type FleetMemberStatus = 'PENDING' | 'ACTIVE' | 'DEACTIVATED' | 'REMOVED' | 'REJECTED';

/** What an owner sees the moment they finish registering. */
export interface FleetRegistrationDto {
  fleetNumber: string;
  name: string;
  status: FleetStatus;
}

/** A rider's own view of the fleet number they entered. */
export interface FleetJoinRequestDto {
  memberId: string;
  fleetNumber: string;
  fleetName: string;
  role: FleetMemberRole;
  status: FleetMemberStatus;
  requestedAt: string;
  rejectedReason: string | null;
}

export interface FleetDto {
  id: string;
  /** The Fleet DX number an owner quotes to Operations, e.g. `DX-FL-0001`. */
  fleetNumber: string;
  name: string;
  contactPhone: string | null;
  status: FleetStatus;
  suspendedReason: string | null;
  createdAt: string;
}

export interface FleetMemberDto {
  memberId: string;
  userId: string;
  name: string;
  phone: string | null;
  role: FleetMemberRole;
  status: FleetMemberStatus;
  deactivatedReason: string | null;
  joinedAt: string;

  online: boolean;
  onJob: boolean;

  /**
   * Null unless the person is working and their position is fresh. Founder
   * decision 2026-08-30: an owner sees where a rider is on a shift, not where
   * they are on their own time.
   */
  latitude: number | null;
  longitude: number | null;
  positionAt: string | null;

  /** Completed rides and deliveries so far this calendar month. */
  completedThisMonth: number;
  /** Fares and delivery fees those jobs carried. Not the rider's take-home —
   * what the rider is paid is between them and the fleet owner. */
  grossThisMonth: number;
}

export interface FleetJobDto {
  jobId: string;
  kind: 'RIDE' | 'DELIVERY';
  status: RideStatus | DeliveryStatus;
  memberName: string;
  memberUserId: string | null;
  amount: number;
  startedAt: string;
}

/**
 * The fleet's running month.
 *
 * `projectedRate` is an estimate and says so: the whole month settles at the
 * band its final volume reaches, so crossing a threshold on the last day
 * re-prices every order before it. Nothing is charged until the month closes.
 */
export interface FleetPeriodDto {
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  /** What commission is charged on: delivery fees plus trip fares. */
  chargeableTotal: number;
  projectedRate: number | null;
  projectedCommission: number | null;
  settled: boolean;
  appliedRate: number | null;
  commissionAmount: number | null;
}

/**
 * Named `FleetConsole...` because `FleetSummaryDto` already belongs to the
 * Operations live-fleet snapshot, which counts DrippleX's whole driver fleet.
 * This one counts one company's people. Two different fleets, two names.
 */
export interface FleetConsoleSummaryDto {
  totalMembers: number;
  onlineMembers: number;
  onJobMembers: number;
  deactivatedMembers: number;
  /** Riders waiting on the owner to confirm they work for this fleet. */
  pendingRequests: number;
}

export interface FleetOverviewDto {
  fleet: FleetDto;
  members: FleetMemberDto[];
  /**
   * Riders who quoted this fleet's DX number and are waiting to be confirmed.
   * Separate from `members` because they are not members yet — showing them in
   * the same list is how an owner ends up confirming people by accident.
   */
  pendingRequests: FleetMemberDto[];
  liveJobs: FleetJobDto[];
  period: FleetPeriodDto;
  summary: FleetConsoleSummaryDto;
}

/**
 * One volume band. `maxOrders` null is the open-ended top band, and exactly
 * one band must be open-ended or a fleet that outgrows the table has no rate.
 * `rate` is a fraction: 0.08 is 8%.
 */
export interface FleetCommissionTierDto {
  id: string;
  minOrders: number;
  maxOrders: number | null;
  rate: number;
}

/**
 * One row of Operations' fleet dashboard.
 *
 * Carries more than `FleetDto` because the question an operator actually has
 * is never "does this fleet exist" — it is who runs it, how many people they
 * have out, and what they owe this month. A list of names and DX numbers would
 * send them into each fleet one at a time to find that out.
 */
export interface AdminFleetListItemDto {
  fleet: FleetDto;
  owner: {
    userId: string;
    name: string;
    phone: string | null;
    email: string;
  };
  memberCounts: {
    total: number;
    active: number;
    deactivated: number;
  };
  /** The running month — the same figures the owner sees on their own console. */
  period: FleetPeriodDto;
  /**
   * A rate agreed with this fleet, overriding the band table. Null means the
   * table applies, which is a different thing from a rate of zero.
   */
  negotiatedRate: number | null;
  negotiationNote: string | null;
  negotiatedAt: string | null;
}
