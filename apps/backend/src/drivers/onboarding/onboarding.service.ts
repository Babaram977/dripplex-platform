import { Injectable } from '@nestjs/common';
import { OnboardingStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { DRIVER_AUDIT_ACTIONS } from '../driver.constants';

import { toDriverOnboardingDto } from './onboarding.mapper';

import type { AcceptDriverAgreementDto } from '../dto/accept-driver-agreement.dto';
import type { SubmitEmergencyContactDto } from '../dto/submit-emergency-contact.dto';
import type { DriverOnboardingDto } from '@dripplex/types';
import type { DriverOnboarding, DriverProfile } from '@prisma/client';

/** DPX-DRIVER-002 Phase 1 — structured onboarding submission tracking. Wraps
 * the pre-existing-but-previously-unused `DriverOnboarding` model. Driver-side
 * only for this pass: emergency contact, agreement acceptance, and a final
 * "submit for review" transition. Does NOT yet drive `DriverProfile.status`
 * or gate `DriversService.approveDriver()` — that wiring is a deliberately
 * scoped-out follow-up (see docs/DRIVER-APP-DPX-100-AUDIT.md). */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async getOwnOnboarding(driverUserId: string): Promise<DriverOnboardingDto> {
    const profile = await this.requireDriverProfile(driverUserId);
    const onboarding = await this.getOrCreateOnboarding(profile.id);
    return toDriverOnboardingDto(onboarding, driverUserId);
  }

  public async submitEmergencyContact(
    driverUserId: string,
    dto: SubmitEmergencyContactDto,
    context: AuditContext,
  ): Promise<DriverOnboardingDto> {
    const profile = await this.requireDriverProfile(driverUserId);

    await this.prisma.driverProfile.update({
      where: { userId: driverUserId },
      data: {
        emergencyContactName: dto.emergencyContactName.trim(),
        emergencyContactPhone: dto.emergencyContactPhone.trim(),
        emergencyContactRelationship: dto.emergencyContactRelationship.trim(),
        emergencyContactEmail: dto.emergencyContactEmail?.trim() ?? null,
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.EMERGENCY_CONTACT_UPDATED,
      { ...context, userId: driverUserId },
      { resource: 'driver_profile', resourceId: profile.id },
    );

    const onboarding = await this.getOrCreateOnboarding(profile.id);
    return toDriverOnboardingDto(onboarding, driverUserId);
  }

  public async acceptAgreement(
    driverUserId: string,
    dto: AcceptDriverAgreementDto,
    context: AuditContext,
  ): Promise<DriverOnboardingDto> {
    const profile = await this.requireDriverProfile(driverUserId);

    await this.prisma.driverProfile.update({
      where: { userId: driverUserId },
      data: {
        agreementVersion: dto.agreementVersion,
        agreementAcceptedAt: new Date(),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.AGREEMENT_ACCEPTED,
      { ...context, userId: driverUserId },
      {
        resource: 'driver_profile',
        resourceId: profile.id,
        metadata: { version: dto.agreementVersion },
      },
    );

    const onboarding = await this.getOrCreateOnboarding(profile.id);
    return toDriverOnboardingDto(onboarding, driverUserId);
  }

  public async submitForReview(
    driverUserId: string,
    context: AuditContext,
  ): Promise<DriverOnboardingDto> {
    const profile = await this.requireDriverProfile(driverUserId);
    const onboarding = await this.getOrCreateOnboarding(profile.id);

    if (
      onboarding.status === OnboardingStatus.SUBMITTED ||
      onboarding.status === OnboardingStatus.UNDER_REVIEW ||
      onboarding.status === OnboardingStatus.APPROVED
    ) {
      throw new ValidationDomainException(
        `Onboarding has already been submitted (status: ${onboarding.status})`,
      );
    }

    const kycCount = await this.prisma.driverKyc.count({ where: { driverId: driverUserId } });
    const missing: string[] = [];
    if (!profile.emergencyContactName || !profile.emergencyContactPhone) {
      missing.push('emergency contact');
    }
    if (!profile.agreementAcceptedAt) {
      missing.push('driver agreement acceptance');
    }
    if (kycCount === 0) {
      missing.push('at least one KYC document');
    }
    if (missing.length > 0) {
      throw new ValidationDomainException(
        `Onboarding is incomplete (missing: ${missing.join(', ')})`,
      );
    }

    const updated = await this.prisma.driverOnboarding.update({
      where: { id: onboarding.id },
      data: { status: OnboardingStatus.SUBMITTED },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.ONBOARDING_SUBMITTED,
      { ...context, userId: driverUserId },
      { resource: 'driver_onboarding', resourceId: updated.id },
    );

    return toDriverOnboardingDto(updated, driverUserId);
  }

  private async getOrCreateOnboarding(driverProfileId: string): Promise<DriverOnboarding> {
    const existing = await this.prisma.driverOnboarding.findUnique({
      where: { driverProfileId },
    });
    if (existing) {
      return existing;
    }
    return await this.prisma.driverOnboarding.create({ data: { driverProfileId } });
  }

  private async requireDriverProfile(driverUserId: string): Promise<DriverProfile> {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId: driverUserId } });
    if (!profile) {
      throw new NotFoundDomainException('Driver profile not found');
    }
    return profile;
  }
}
