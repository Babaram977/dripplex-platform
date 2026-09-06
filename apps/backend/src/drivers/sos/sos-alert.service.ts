import { Injectable } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  RideStatus,
  SosAlertOrigin,
  SosAlertStatus,
  VehicleApprovalStatus,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
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
 * IncidentReport/DriverRideContactService.
 *
 * DPX-SAFETY-001 (founder-requested 2026-09-06) adds the passenger side:
 * `triggerForCustomer` writes the SAME `SosAlert` row with
 * `origin = CUSTOMER`, so Operations keeps one queue instead of two. The
 * three decisions that shaped it, recorded here because none was covered
 * by the 2026-08-04 approval:
 *
 * 1. A customer may only raise SOS during an active ride. The screen is
 *    reached from the in-ride flow and renders a "Current Trip" card, and
 *    an active ride is what supplies the driver, vehicle and route context
 *    that makes an alert actionable. SOS with no trip in progress is a
 *    real gap, deferred rather than guessed at.
 * 2. The driver is NOT notified that their passenger raised an SOS. The
 *    mirror of the driver flow would be to tell them, but the passenger's
 *    emergency may be the driver — telling them is the one action that
 *    could make it worse. Operations decides who to contact.
 * 3. Still no auto-dial to emergency services, unchanged from the locked
 *    v1 decision. The screen offers the passenger a dialler; DrippleX
 *    never places the call itself. */
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
        origin: SosAlertOrigin.DRIVER,
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
        metadata: { origin: alert.origin, rideId: alert.rideId, vehicleId: alert.vehicleId },
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

  /**
   * DPX-SAFETY-001 — the passenger pressed SOS.
   *
   * Same row, same Operations queue, same CRITICAL push as the driver
   * path. Only available during an active ride (decision 1 on the class
   * doc); the driver is resolved server-side from that ride rather than
   * accepted from the client, for the same anti-spoofing reason
   * `CreateSosAlertDto` refuses a `rideId`.
   */
  public async triggerForCustomer(
    customerUserId: string,
    dto: CreateSosAlertDto,
    context: AuditContext,
  ): Promise<SosAlertDto> {
    const activeRide = await this.prisma.ride.findFirst({
      where: {
        customerId: customerUserId,
        status: {
          in: [RideStatus.DRIVER_ASSIGNED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS],
        },
      },
      orderBy: { requestedAt: 'desc' },
      select: { id: true, driverId: true },
    });

    // Deliberately explicit rather than silently filing a context-free
    // alert: an alert Operations cannot act on is worse than a clear "not
    // yet" the screen can show. `Ride.driverId` is nullable in the schema,
    // so it is checked rather than asserted even though the three statuses
    // above always have one.
    if (!activeRide?.driverId) {
      throw new ValidationDomainException(
        'Emergency SOS is available while a trip is in progress. Call emergency services directly if you need help now.',
      );
    }

    const activeVehicle = await this.prisma.vehicle.findFirst({
      where: {
        driverId: activeRide.driverId,
        isActive: true,
        approvalStatus: VehicleApprovalStatus.APPROVED,
      },
      select: { id: true },
    });

    const alert = await this.prisma.sosAlert.create({
      data: {
        origin: SosAlertOrigin.CUSTOMER,
        driverId: activeRide.driverId,
        customerId: customerUserId,
        rideId: activeRide.id,
        ...(activeVehicle ? { vehicleId: activeVehicle.id } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.batteryLevel !== undefined ? { batteryLevel: dto.batteryLevel } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.SOS_ALERT_TRIGGERED,
      { ...context, userId: customerUserId },
      {
        resource: 'sos_alert',
        resourceId: alert.id,
        metadata: { origin: alert.origin, rideId: alert.rideId, vehicleId: alert.vehicleId },
      },
    );

    await this.notifyOperations(alert);

    // No notification to the driver — decision 2 on the class doc.
    return toSosAlertDto(alert);
  }

  /** Driver-raised alerts only. A customer-raised alert on this driver's
   * ride is Operations' business, not the driver's — see decision 2. */
  public async listOwnAlerts(driverUserId: string): Promise<SosAlertDto[]> {
    const alerts = await this.prisma.sosAlert.findMany({
      where: { driverId: driverUserId, origin: SosAlertOrigin.DRIVER },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map(toSosAlertDto);
  }

  public async getOwnAlert(driverUserId: string, alertId: string): Promise<SosAlertDto> {
    const alert = await this.requireOwnedAlert(driverUserId, alertId);
    return toSosAlertDto(alert);
  }

  public async listOwnCustomerAlerts(customerUserId: string): Promise<SosAlertDto[]> {
    const alerts = await this.prisma.sosAlert.findMany({
      where: { customerId: customerUserId, origin: SosAlertOrigin.CUSTOMER },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map(toSosAlertDto);
  }

  public async getOwnCustomerAlert(customerUserId: string, alertId: string): Promise<SosAlertDto> {
    const alert = await this.requireAlert(alertId);
    if (alert.origin !== SosAlertOrigin.CUSTOMER || alert.customerId !== customerUserId) {
      throw new ForbiddenDomainException('You do not have access to this SOS alert');
    }
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

    // The raiser, not the driver. On a customer-raised alert the driver is
    // recorded for context only and must not be told about it (decision 2
    // on the class doc); `customerId` is checked rather than asserted
    // because it is nullable in the schema.
    const raiserUserId =
      updated.origin === SosAlertOrigin.CUSTOMER ? updated.customerId : updated.driverId;

    if (raiserUserId) {
      await this.notificationCenter.send({
        userId: raiserUserId,
        category: NotificationCategory.EMERGENCY,
        channel: NotificationChannel.IN_APP,
        type: NotificationType.SOS_ALERT_UPDATED,
        priority: NotificationPriority.HIGH,
        title: 'SOS alert updated',
        body: dto.adminNotes ?? `Your SOS alert is now ${updated.status.toLowerCase()}.`,
        payload: { sosAlertId: updated.id, status: updated.status },
      });
    }

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

    // A dispatcher must be able to tell from the push alone whether the
    // person in trouble is the driver or the passenger, because who they
    // call back differs.
    const raisedByCustomer = alert.origin === SosAlertOrigin.CUSTOMER;

    await this.notificationCenter.broadcast({
      userIds: opsUsers.map((user) => user.id),
      category: NotificationCategory.EMERGENCY,
      channel: NotificationChannel.IN_APP,
      type: NotificationType.SOS_ALERT_TRIGGERED,
      priority: NotificationPriority.CRITICAL,
      title: raisedByCustomer ? 'SOS: passenger needs assistance' : 'SOS: driver needs assistance',
      body: raisedByCustomer
        ? 'A passenger has triggered an SOS alert during a trip. Review immediately.'
        : 'A driver has triggered an SOS alert. Review immediately.',
      payload: {
        sosAlertId: alert.id,
        origin: alert.origin,
        driverId: alert.driverId,
        customerId: alert.customerId,
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
    if (alert.driverId !== driverUserId || alert.origin !== SosAlertOrigin.DRIVER) {
      throw new ForbiddenDomainException('You do not have access to this SOS alert');
    }
    return alert;
  }
}
