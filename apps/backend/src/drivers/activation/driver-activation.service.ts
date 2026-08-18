import { Injectable } from '@nestjs/common';
import { InspectionStatus, KycVerificationStatus, VehicleApprovalStatus } from '@prisma/client';

import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRED_DRIVER_KYC_DOCUMENT_TYPES } from '../driver.constants';

import type { DriverActivationChecks, DriverActivationEligibilityDto } from '@dripplex/types';

const MISSING_REASON_BY_CHECK: Record<keyof DriverActivationChecks, string> = {
  identityVerified: 'Identity verification (facial/liveness check) has not been passed',
  requiredDocumentsApproved: 'One or more required KYC documents are missing or not yet verified',
  vehicleApproved: 'No approved, active vehicle on file',
  inspectionPassed: "No approved vehicle's latest physical inspection has passed",
  agreementAccepted: 'Driver agreement has not been accepted',
  accountNotLocked: 'Account is locked pending support review',
};

/** DPX-DRIVER-002 Phase 4 — the single unified driver activation gate.
 * Every place that activates a driver (`DriversService.approveDriver()`,
 * `reactivateDriver()`) calls `assertEligible()` here rather than
 * duplicating any of these six conditions itself — this is the one place
 * that defines what "eligible to be Active" means platform-wide. Also
 * exposed read-only via `checkEligibility()` so a driver or admin can see
 * exactly what's blocking activation before attempting it. */
@Injectable()
export class DriverActivationService {
  constructor(private readonly prisma: PrismaService) {}

  public async checkEligibility(driverUserId: string): Promise<DriverActivationEligibilityDto> {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });
    if (!profile) {
      throw new NotFoundDomainException('Driver profile not found');
    }

    const [kyc, approvedVehicles] = await Promise.all([
      this.prisma.driverKyc.findMany({ where: { driverId: driverUserId } }),
      this.prisma.vehicle.findMany({
        where: {
          driverId: driverUserId,
          approvalStatus: VehicleApprovalStatus.APPROVED,
          isActive: true,
        },
      }),
    ]);

    const identityVerified = profile.lastIdentityVerifiedAt !== null;

    const requiredDocumentsApproved = REQUIRED_DRIVER_KYC_DOCUMENT_TYPES.every((type) =>
      kyc.some(
        (doc) =>
          doc.documentType === type && doc.verificationStatus === KycVerificationStatus.VERIFIED,
      ),
    );

    const vehicleApproved = approvedVehicles.length > 0;

    // "Latest inspection passed" — vehicle approval alone isn't proof of a
    // passed inspection (an admin can approve a vehicle manually); check
    // each approved vehicle's most recently *decided* inspection directly.
    let inspectionPassed = false;
    let qualifyingVehicleId: string | null = null;
    if (vehicleApproved) {
      const vehicleIds = approvedVehicles.map((vehicle) => vehicle.id);
      const decidedInspections = await this.prisma.inspection.findMany({
        where: {
          vehicleId: { in: vehicleIds },
          status: { in: [InspectionStatus.PASSED, InspectionStatus.FAILED] },
        },
        orderBy: { completedAt: 'desc' },
      });
      for (const vehicleId of vehicleIds) {
        const latest = decidedInspections.find((inspection) => inspection.vehicleId === vehicleId);
        if (latest?.status === InspectionStatus.PASSED) {
          inspectionPassed = true;
          qualifyingVehicleId = vehicleId;
          break;
        }
      }
    }

    const agreementAccepted = profile.agreementAcceptedAt !== null;
    const accountNotLocked = profile.identityVerificationLockedAt === null;

    const checks: DriverActivationChecks = {
      identityVerified,
      requiredDocumentsApproved,
      vehicleApproved,
      inspectionPassed,
      agreementAccepted,
      accountNotLocked,
    };

    const missingReasons = (Object.keys(checks) as (keyof DriverActivationChecks)[])
      .filter((key) => !checks[key])
      .map((key) => MISSING_REASON_BY_CHECK[key]);

    return {
      driverId: driverUserId,
      eligible: missingReasons.length === 0,
      checks,
      missingReasons,
      qualifyingVehicleId,
    };
  }

  /**
   * The same six checks, for a page of drivers at once.
   *
   * The Ops driver roster shows a column of "Pending" badges and nothing about
   * why — an operator had to open each driver in turn to find the one unmet
   * check. Calling `checkEligibility` per row would be four queries per driver;
   * this is four queries for the whole page, whatever its size.
   *
   * Deliberately re-derives the checks from the same fields and the same rules
   * rather than sharing a helper with `checkEligibility`: if the two ever
   * disagree the roster is lying, so they are covered by a spec that asserts
   * they agree driver-for-driver.
   */
  public async checkEligibilityBulk(
    driverUserIds: string[],
  ): Promise<Map<string, DriverActivationEligibilityDto>> {
    const results = new Map<string, DriverActivationEligibilityDto>();
    if (driverUserIds.length === 0) {
      return results;
    }

    const [profiles, kyc, vehicles] = await Promise.all([
      this.prisma.driverProfile.findMany({ where: { userId: { in: driverUserIds } } }),
      this.prisma.driverKyc.findMany({ where: { driverId: { in: driverUserIds } } }),
      this.prisma.vehicle.findMany({
        where: {
          driverId: { in: driverUserIds },
          approvalStatus: VehicleApprovalStatus.APPROVED,
          isActive: true,
        },
      }),
    ]);

    const decidedInspections =
      vehicles.length === 0
        ? []
        : await this.prisma.inspection.findMany({
            where: {
              vehicleId: { in: vehicles.map((vehicle) => vehicle.id) },
              status: { in: [InspectionStatus.PASSED, InspectionStatus.FAILED] },
            },
            orderBy: { completedAt: 'desc' },
          });

    for (const profile of profiles) {
      const driverKyc = kyc.filter((doc) => doc.driverId === profile.userId);
      const driverVehicles = vehicles.filter((vehicle) => vehicle.driverId === profile.userId);

      let inspectionPassed = false;
      let qualifyingVehicleId: string | null = null;
      for (const vehicle of driverVehicles) {
        // Latest *decided* inspection per vehicle — an old pass followed by a
        // fail must not keep a driver activated.
        const latest = decidedInspections.find((inspection) => inspection.vehicleId === vehicle.id);
        if (latest?.status === InspectionStatus.PASSED) {
          inspectionPassed = true;
          qualifyingVehicleId = vehicle.id;
          break;
        }
      }

      const checks: DriverActivationChecks = {
        identityVerified: profile.lastIdentityVerifiedAt !== null,
        requiredDocumentsApproved: REQUIRED_DRIVER_KYC_DOCUMENT_TYPES.every((type) =>
          driverKyc.some(
            (doc) =>
              doc.documentType === type &&
              doc.verificationStatus === KycVerificationStatus.VERIFIED,
          ),
        ),
        vehicleApproved: driverVehicles.length > 0,
        inspectionPassed,
        agreementAccepted: profile.agreementAcceptedAt !== null,
        accountNotLocked: profile.identityVerificationLockedAt === null,
      };

      const missingReasons = (Object.keys(checks) as (keyof DriverActivationChecks)[])
        .filter((key) => !checks[key])
        .map((key) => MISSING_REASON_BY_CHECK[key]);

      results.set(profile.userId, {
        driverId: profile.userId,
        eligible: missingReasons.length === 0,
        checks,
        missingReasons,
        qualifyingVehicleId,
      });
    }

    return results;
  }

  /** Throws with the full list of unmet conditions if the driver isn't
   * eligible; returns the (eligible) result otherwise. The only entry point
   * `DriversService` should use before flipping a driver to `APPROVED`. */
  public async assertEligible(driverUserId: string): Promise<DriverActivationEligibilityDto> {
    const result = await this.checkEligibility(driverUserId);
    if (!result.eligible) {
      throw new ValidationDomainException(
        `Driver does not meet activation requirements (${result.missingReasons.join('; ')})`,
        { checks: result.checks },
      );
    }
    return result;
  }
}
