import { Injectable } from '@nestjs/common';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DRIVER_AUDIT_ACTIONS, DRIVER_SECURITY_SETTINGS_ID } from '../driver.constants';

import type { DriverSecuritySettings } from '@prisma/client';

export interface DriverSecuritySettingsUpdateInput {
  idleHours?: number;
  gpsAnomalySpeedKmh?: number;
  lockoutThreshold?: number;
  spotCheckDenominator?: number;
  newDeviceVerificationEnabled?: boolean;
  adminForceVerificationEnabled?: boolean;
  /** Periodic re-verification of an already-verified driver. Onboarding is
   * never affected by this. */
  periodicVerificationEnabled?: boolean;
}

/**
 * Driver-001 Security Standard — the admin-configurable risk-engine policy
 * (docs/DPX-DRIVER-001-SECURITY-STANDARD.md). A single row, read on every
 * risk-engine evaluation and editable by an admin without a redeploy.
 * `AppConfigService`/env vars only seed the row's initial values the first
 * time it's created — the DB row is the source of truth afterward.
 */
@Injectable()
export class DriverSecuritySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly appConfig: AppConfigService,
  ) {}

  public async getEffective(): Promise<DriverSecuritySettings> {
    const existing = await this.prisma.driverSecuritySettings.findUnique({
      where: { id: DRIVER_SECURITY_SETTINGS_ID },
    });
    if (existing) {
      return existing;
    }

    return await this.prisma.driverSecuritySettings.create({
      data: {
        id: DRIVER_SECURITY_SETTINGS_ID,
        idleHours: this.appConfig.identityVerificationIdleHours,
        gpsAnomalySpeedKmh: this.appConfig.driverIdvGpsAnomalySpeedKmh,
        lockoutThreshold: this.appConfig.driverIdvLockoutThreshold,
        spotCheckDenominator: this.appConfig.driverIdvSpotCheckDenominator,
      },
    });
  }

  public async update(
    input: DriverSecuritySettingsUpdateInput,
    adminUserId: string,
    context: AuditContext,
  ): Promise<DriverSecuritySettings> {
    const before = await this.getEffective();

    const updated = await this.prisma.driverSecuritySettings.update({
      where: { id: DRIVER_SECURITY_SETTINGS_ID },
      data: {
        ...(input.idleHours !== undefined ? { idleHours: input.idleHours } : {}),
        ...(input.gpsAnomalySpeedKmh !== undefined
          ? { gpsAnomalySpeedKmh: input.gpsAnomalySpeedKmh }
          : {}),
        ...(input.lockoutThreshold !== undefined
          ? { lockoutThreshold: input.lockoutThreshold }
          : {}),
        ...(input.spotCheckDenominator !== undefined
          ? { spotCheckDenominator: input.spotCheckDenominator }
          : {}),
        ...(input.newDeviceVerificationEnabled !== undefined
          ? { newDeviceVerificationEnabled: input.newDeviceVerificationEnabled }
          : {}),
        ...(input.periodicVerificationEnabled !== undefined
          ? { periodicVerificationEnabled: input.periodicVerificationEnabled }
          : {}),
        ...(input.adminForceVerificationEnabled !== undefined
          ? { adminForceVerificationEnabled: input.adminForceVerificationEnabled }
          : {}),
        updatedBy: adminUserId,
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.SECURITY_SETTINGS_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'driver_security_settings',
        resourceId: updated.id,
        metadata: {
          before: DriverSecuritySettingsService.toMetadata(before),
          after: DriverSecuritySettingsService.toMetadata(updated),
        },
      },
    );

    return updated;
  }

  private static toMetadata(settings: DriverSecuritySettings): Record<string, number | boolean> {
    return {
      idleHours: settings.idleHours,
      gpsAnomalySpeedKmh: settings.gpsAnomalySpeedKmh,
      lockoutThreshold: settings.lockoutThreshold,
      spotCheckDenominator: settings.spotCheckDenominator,
      newDeviceVerificationEnabled: settings.newDeviceVerificationEnabled,
      adminForceVerificationEnabled: settings.adminForceVerificationEnabled,
      periodicVerificationEnabled: settings.periodicVerificationEnabled,
    };
  }
}
