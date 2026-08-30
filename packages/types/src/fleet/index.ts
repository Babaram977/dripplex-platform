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
export type FleetStatus = 'ACTIVE' | 'SUSPENDED';
export type FleetMemberRole = 'RIDER' | 'DRIVER';
export type FleetMemberStatus = 'ACTIVE' | 'DEACTIVATED' | 'REMOVED';

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
  deliveryFeeTotal: number;
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
}

export interface FleetOverviewDto {
  fleet: FleetDto;
  members: FleetMemberDto[];
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
