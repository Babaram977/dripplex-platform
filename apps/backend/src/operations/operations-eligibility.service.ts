import { Injectable } from '@nestjs/common';
import {
  DriverStatus,
  InspectionStatus,
  KycVerificationStatus,
  RiderStatus,
  VehicleApprovalStatus,
} from '@prisma/client';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_RIDER_KYC_DOCUMENT_TYPES } from '../riders/rider.constants';
import { DRIVER_LOCATION_MAX_AGE_MS } from '../rides/ride.constants';

import type { DispatchEligibilityDto, DispatchGateDto } from '@dripplex/types';

/** Documents a driver must have VERIFIED. Mirrors the driver activation
 *  gate rather than redefining it. */
const REQUIRED_DRIVER_DOCUMENT_LABELS: Record<string, string> = {
  NATIONAL_ID: 'National ID',
  DRIVERS_LICENSE: "Driver's licence",
  GUARANTOR_ID: 'Guarantor ID',
  PROOF_OF_ADDRESS: 'Proof of address',
  VEHICLE_REGISTRATION: 'Vehicle registration',
  ROAD_WORTHINESS: 'Road worthiness',
  INSURANCE: 'Insurance',
};

function documentLabel(documentType: string): string {
  return REQUIRED_DRIVER_DOCUMENT_LABELS[documentType] ?? documentType.replace(/_/g, ' ');
}

function gate(
  key: DispatchGateDto['key'],
  label: string,
  passed: boolean,
  fixableBy: DispatchGateDto['fixableBy'],
  detail: string | null = null,
): DispatchGateDto {
  return { key, label, passed, fixableBy, detail: passed ? null : detail };
}

/** "47 minutes ago", for a position age an operator can act on. */
function ago(from: Date, now: Date): string {
  const minutes = Math.round((now.getTime() - from.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  return `${String(hours)} hour${hours === 1 ? '' : 's'} ago`;
}

/**
 * Answers "why is this person not getting work".
 *
 * Every gate reported here already governed dispatch and every one of them
 * was silent. A rider with one unverified document was told "You are live"
 * while `listAvailableRiders` filtered them out, and the only way to find out
 * was to read the query. Operations could see that a driver was online and
 * that a job was unassigned, and nothing that connected the two.
 *
 * This reads the SAME conditions the dispatchers use rather than describing
 * them a second time — a panel that drifts from the query it explains is
 * worse than no panel, because it is confidently wrong.
 */
@Injectable()
export class OperationsEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  public async getRiderEligibility(riderUserId: string): Promise<DispatchEligibilityDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: riderUserId, deletedAt: null },
      include: { riderProfile: true, riderKycDocuments: true, riderAvailability: true },
    });
    if (!user?.riderProfile) {
      throw new NotFoundDomainException('Rider not found');
    }

    const now = new Date();
    const profile = user.riderProfile;
    const availability = user.riderAvailability;
    const gates: DispatchGateDto[] = [];

    const approved =
      profile.status === RiderStatus.APPROVED && profile.isApproved && profile.deletedAt === null;
    gates.push(
      gate(
        'PROFILE_APPROVED',
        'Rider approved',
        approved,
        'OPERATIONS',
        `Profile is ${profile.status}${profile.isApproved ? '' : ', not approved'}`,
      ),
    );

    // Named individually. "KYC incomplete" sends an operator hunting; "Guarantor
    // ID is still PENDING" tells them exactly what to open.
    const unverified = REQUIRED_RIDER_KYC_DOCUMENT_TYPES.filter(
      (documentType) =>
        !user.riderKycDocuments.some(
          (document) =>
            document.documentType === documentType &&
            document.verificationStatus === KycVerificationStatus.VERIFIED,
        ),
    );
    gates.push(
      gate(
        'KYC_VERIFIED',
        'KYC documents verified',
        unverified.length === 0,
        'OPERATIONS',
        unverified
          .map((documentType) => {
            const submitted = user.riderKycDocuments.find(
              (document) => document.documentType === documentType,
            );
            return `${documentLabel(documentType)} ${
              submitted ? `is ${submitted.verificationStatus}` : 'has not been submitted'
            }`;
          })
          .join('; '),
      ),
    );

    gates.push(
      ...this.liveGates(
        {
          online: availability?.online ?? false,
          accepting: availability?.acceptingOrders ?? false,
          latitude: availability?.latitude ?? null,
          longitude: availability?.longitude ?? null,
          // Delivery dispatch does not filter on position AGE — only on a
          // position existing. Reported anyway, and marked as passing,
          // because a stale rider position is still worth an operator seeing
          // even though it is not what is blocking the job.
          positionAt: availability?.updatedAt ?? null,
          enforceFreshness: false,
        },
        now,
      ),
      gate('CAPACITY', 'Has spare capacity', true, 'DRIVER', null),
    );

    return {
      subjectId: riderUserId,
      subjectName: `${user.firstName} ${user.lastName}`.trim(),
      phone: user.phone,
      role: 'RIDER',
      dispatchable: gates.every((entry) => entry.passed),
      gates,
      vehicle: null,
    };
  }

  public async getDriverEligibility(driverUserId: string): Promise<DispatchEligibilityDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: driverUserId, deletedAt: null },
      include: { driverProfile: true, driverKycDocuments: true, driverAvailability: true },
    });
    if (!user?.driverProfile) {
      throw new NotFoundDomainException('Driver not found');
    }

    const now = new Date();
    const profile = user.driverProfile;
    const availability = user.driverAvailability;
    const gates: DispatchGateDto[] = [];

    const approved = profile.status === DriverStatus.APPROVED;
    gates.push(
      gate(
        'PROFILE_APPROVED',
        'Driver approved',
        approved,
        'OPERATIONS',
        `Profile is ${profile.status}`,
      ),
    );

    const unverified = user.driverKycDocuments.filter(
      (document) => document.verificationStatus !== KycVerificationStatus.VERIFIED,
    );
    gates.push(
      gate(
        'KYC_VERIFIED',
        'KYC documents verified',
        unverified.length === 0 && user.driverKycDocuments.length > 0,
        'OPERATIONS',
        user.driverKycDocuments.length === 0
          ? 'No documents submitted'
          : unverified
              .map(
                (document) =>
                  `${documentLabel(document.documentType)} is ${document.verificationStatus}`,
              )
              .join('; '),
      ),
    );

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { driverId: driverUserId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    gates.push(
      gate(
        'VEHICLE_APPROVED',
        'Vehicle approved',
        vehicle?.approvalStatus === VehicleApprovalStatus.APPROVED,
        'OPERATIONS',
        vehicle === null
          ? 'No active vehicle on file'
          : `${vehicle.plateNumber} is ${vehicle.approvalStatus}`,
      ),
    );

    // Vehicle approval alone is not proof of a passed inspection — the fleet
    // status uses the most recently DECIDED inspection, and so does this.
    const inspection = vehicle
      ? await this.prisma.inspection.findFirst({
          where: {
            vehicleId: vehicle.id,
            status: { in: [InspectionStatus.PASSED, InspectionStatus.FAILED] },
          },
          orderBy: { completedAt: 'desc' },
        })
      : null;
    gates.push(
      gate(
        'INSPECTION_PASSED',
        'Inspection passed',
        inspection?.status === InspectionStatus.PASSED,
        'OPERATIONS',
        inspection === null
          ? 'No inspection has been decided'
          : `Latest inspection ${inspection.status}`,
      ),
    );

    gates.push(
      ...this.liveGates(
        {
          online: availability?.online ?? false,
          accepting: availability?.acceptingRides ?? false,
          latitude: availability?.latitude ?? null,
          longitude: availability?.longitude ?? null,
          // Ride dispatch DOES enforce position age, so a stale driver here
          // is genuinely undispatchable and the gate must fail.
          positionAt: availability?.locationUpdatedAt ?? null,
          enforceFreshness: true,
        },
        now,
      ),
      gate(
        'CAPACITY',
        'Not already on a trip',
        (availability?.activeRideCount ?? 0) === 0,
        'DRIVER',
        `Currently on ${String(availability?.activeRideCount ?? 0)} trip(s)`,
      ),
    );

    return {
      subjectId: driverUserId,
      subjectName: `${user.firstName} ${user.lastName}`.trim(),
      phone: user.phone,
      role: 'DRIVER',
      dispatchable: gates.every((entry) => entry.passed),
      gates,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            plateNumber: vehicle.plateNumber,
            make: vehicle.make,
            model: vehicle.model,
            colour: vehicle.color,
            year: vehicle.year,
            rideCategory: vehicle.rideCategory,
            approvalStatus: vehicle.approvalStatus,
            seats: vehicle.seats ?? null,
          }
        : null,
    };
  }

  /** The gates only the driver can clear, shared by both roles. */
  private liveGates(
    input: {
      online: boolean;
      accepting: boolean;
      latitude: unknown;
      longitude: unknown;
      positionAt: Date | null;
      enforceFreshness: boolean;
    },
    now: Date,
  ): DispatchGateDto[] {
    const hasPosition = input.latitude !== null && input.longitude !== null;
    const fresh =
      input.positionAt !== null &&
      now.getTime() - input.positionAt.getTime() <= DRIVER_LOCATION_MAX_AGE_MS;

    return [
      gate('ONLINE', 'Online', input.online, 'DRIVER', 'Signed off in the app'),
      gate('ACCEPTING', 'Accepting work', input.accepting, 'DRIVER', 'Not accepting new work'),
      gate(
        'POSITION_KNOWN',
        'Position known',
        hasPosition,
        'DRIVER',
        // The live failure a test already pins: online, accepting, and
        // invisible, because dispatch cannot rank a candidate it cannot place.
        'Went online without sending a position — allow location access in the app',
      ),
      gate(
        'POSITION_FRESH',
        'Position recent',
        input.enforceFreshness ? fresh : true,
        'DRIVER',
        input.positionAt === null
          ? 'No position has ever been reported'
          : `Last position ${ago(input.positionAt, now)}`,
      ),
    ];
  }
}
