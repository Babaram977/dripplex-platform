import { Injectable } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  RideStatus,
  SosAlertStatus,
  VehicleApprovalStatus,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import { NotificationCenterService } from '../../notification-center/notification-center.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DRIVER_AUDIT_ACTIONS, DRIVER_PERMISSIONS } from '../driver.constants';

import { toSosAlertDto } from './sos-alert.mapper';

import type { CreateSosAlertDto } from '../dto/create-sos-alert.dto';
import type { ListSosAlertsQueryDto } from '../dto/list-sos-alerts-query.dto';
import type { UpdateSosAlertDto } from '../dto/update-sos-alert.dto';
import type { SosAlertDto, SosAlertListDto } from '@dripplex/types';
import type { SosAlert } from '@prisma/client';

/** Driver Slice 2 item 5 — SOS/Emergency (founder-approved 2026-08-04):
 * "DrippleX Operations first." Pressing SOS sends an immediate alert to
 * ops (driver id, GPS, active trip, timestamp, vehicle, battery level if
 * available) via NotificationCenterService.broadcast (real Firebase push,
 * CRITICAL priority) to every user holding
 * `admin:drivers:sos:manage`/`ADMIN_SOS_ALERT_MANAGE`. The ride's customer
 * (if any) is separately notified that assistance was requested — nothing
 * more. Deliberately NOT auto-contacting emergency services or the
 * driver's emergency contact in v1 — deferred pending country-specific
 * legal/operational policy (see DRIVER-SLICE-2-AUDIT.md).
 *
 * Lives under `drivers/`, not `rides/` — Ride module is frozen. `rideId`
 * is a plain scalar id (no Prisma relation), same pattern as
 * IncidentReport/DriverRideContactService. */
@Injectable()
export class SosAlertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationCenter: NotificationCenterService,
  ) {}

  public async trigger(
    driverUserId: string,
    dto: CreateSosAlertDto,
    context: AuditContext,
  ): Promise<SosAlertDto> {
    const [activeRide, activeVehicle] = await Promise.all([
      this.prisma.ride.findFirst({
        where: {
          driverId: driverUserId,
          status: {
            in: [RideStatus.DRIVER_ASSIGNED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS],
          },
        },
        orderBy: { requestedAt: 'desc' },
        select: { id: true, customerId: true },
      }),
      this.prisma.vehicle.findFirst({
        where: {
          driverId: driverUserId,
          isActive: true,
          approvalStatus: VehicleApprovalStatus.APPROVED,
        },
        select: { id: true },
      }),
    ]);

    const alert = await this.prisma.sosAlert.create({
      data: {
        driverId: driverUserId,
        ...(activeRide ? { rideId: activeRide.id } : {}),
        ...(activeVehicle ? { vehicleId: activeVehicle.id } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.batteryLevel !== undefined ? { batteryLevel: dto.batteryLevel } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.SOS_ALERT_TRIGGERED,
      { ...context, userId: driverUserId },
      {
        resource: 'sos_alert',
        resourceId: alert.id,
        metadata: { rideId: alert.rideId, vehicleId: alert.vehicleId },
      },
    );

    await this.notifyOperations(alert);

    let customerNotifiedAt: Date | null = null;
    if (activeRide) {
      await this.notificationCenter.send({
        userId: activeRide.customerId,
        category: NotificationCategory.EMERGENCY,
        channel: NotificationChannel.IN_APP,
        type: NotificationType.SOS_ALERT_CUSTOMER_NOTICE,
        priority: NotificationPriority.HIGH,
        title: 'Assistance requested',
        body: 'Your driver has requested assistance. DrippleX Operations has been notified.',
        payload: { sosAlertId: alert.id, rideId: activeRide.id },
      });
      customerNotifiedAt = new Date();
    }

    const updated = customerNotifiedAt
      ? await this.prisma.sosAlert.update({ where: { id: alert.id }, data: { customerNotifiedAt } })
      : alert;

    return toSosAlertDto(updated);
  }

  public async listOwnAlerts(driverUserId: string): Promise<SosAlertDto[]> {
    const alerts = await this.prisma.sosAlert.findMany({
      where: { driverId: driverUserId },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map(toSosAlertDto);
  }

  public async getOwnAlert(driverUserId: string, alertId: string): Promise<SosAlertDto> {
    const alert = await this.requireOwnedAlert(driverUserId, alertId);
    return toSosAlertDto(alert);
  }

  public async listAlerts(query: ListSosAlertsQueryDto): Promise<SosAlertListDto> {
    const where = { ...(query.status ? { status: query.status } : {}) };
    const [alerts, total] = await Promise.all([
      this.prisma.sosAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.sosAlert.count({ where }),
    ]);

    return {
      items: alerts.map(toSosAlertDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /** Admin-only. Any status/notes change notifies the driver in-app. */
  public async updateAlert(
    alertId: string,
    adminUserId: string,
    dto: UpdateSosAlertDto,
    context: AuditContext,
  ): Promise<SosAlertDto> {
    const existing = await this.requireAlert(alertId);

    const isAcknowledging =
      dto.status === SosAlertStatus.ACKNOWLEDGED && existing.status === SosAlertStatus.OPEN;
    const isResolving =
      dto.status === SosAlertStatus.RESOLVED && existing.status !== SosAlertStatus.RESOLVED;

    const updated = await this.prisma.sosAlert.update({
      where: { id: alertId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes.trim() } : {}),
        ...(isAcknowledging ? { acknowledgedBy: adminUserId, acknowledgedAt: new Date() } : {}),
        ...(isResolving ? { resolvedAt: new Date() } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.SOS_ALERT_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'sos_alert',
        resourceId: updated.id,
        metadata: { status: updated.status, hasNotes: dto.adminNotes !== undefined },
      },
    );

    await this.notificationCenter.send({
      userId: updated.driverId,
      category: NotificationCategory.EMERGENCY,
      channel: NotificationChannel.IN_APP,
      type: NotificationType.SOS_ALERT_UPDATED,
      priority: NotificationPriority.HIGH,
      title: 'SOS alert updated',
      body: dto.adminNotes ?? `Your SOS alert is now ${updated.status.toLowerCase()}.`,
      payload: { sosAlertId: updated.id, status: updated.status },
    });

    return toSosAlertDto(updated);
  }

  /** Broadcasts to every user holding ADMIN_SOS_ALERT_MANAGE. If nobody
   * currently holds that permission (e.g. a fresh environment), the alert
   * still exists in the admin queue — this only covers the real-time push. */
  private async notifyOperations(alert: SosAlert): Promise<void> {
    const opsUsers = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              permissions: {
                some: { permission: { code: DRIVER_PERMISSIONS.ADMIN_SOS_ALERT_MANAGE } },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    if (opsUsers.length === 0) {
      return;
    }

    await this.notificationCenter.broadcast({
      userIds: opsUsers.map((user) => user.id),
      category: NotificationCategory.EMERGENCY,
      channel: NotificationChannel.IN_APP,
      type: NotificationType.SOS_ALERT_TRIGGERED,
      priority: NotificationPriority.CRITICAL,
      title: 'SOS: driver needs assistance',
      body: 'A driver has triggered an SOS alert. Review immediately.',
      payload: {
        sosAlertId: alert.id,
        driverId: alert.driverId,
        rideId: alert.rideId,
        vehicleId: alert.vehicleId,
        latitude: alert.latitude ? Number(alert.latitude) : null,
        longitude: alert.longitude ? Number(alert.longitude) : null,
        batteryLevel: alert.batteryLevel,
        triggeredAt: alert.createdAt.toISOString(),
      },
    });
  }

  private async requireAlert(alertId: string): Promise<SosAlert> {
    const alert = await this.prisma.sosAlert.findUnique({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundDomainException('SOS alert not found');
    }
    return alert;
  }

  private async requireOwnedAlert(driverUserId: string, alertId: string): Promise<SosAlert> {
    const alert = await this.requireAlert(alertId);
    if (alert.driverId !== driverUserId) {
      throw new ForbiddenDomainException('You do not have access to this SOS alert');
    }
    return alert;
  }
}
