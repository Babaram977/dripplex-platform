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
