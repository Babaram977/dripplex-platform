import { Injectable } from '@nestjs/common';
import { DriverShiftStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_SHIFT_BREAK_REMINDER_MINUTES,
  DEFAULT_SHIFT_FATIGUE_WARNING_MINUTES,
  DEFAULT_SHIFT_MAX_DAILY_MINUTES,
  DRIVER_AUDIT_ACTIONS,
} from '../driver.constants';

import { toDriverShiftDto } from './shift.mapper';

import type { ForceEndDriverShiftDto } from '../dto/force-end-driver-shift.dto';
import type { ListDriverShiftsQueryDto } from '../dto/list-driver-shifts-query.dto';
import type { DriverShiftDto, DriverShiftListDto, DriverShiftSummaryDto } from '@dripplex/types';
import type { DriverShift } from '@prisma/client';

const MS_PER_MINUTE = 60_000;

/** Driver Slice 2 item 6 — Shift Management (founder-approved 2026-08-04,
 * safety scope added on approval of item 5). A shift is a driver-initiated
 * work session, deliberately independent of `DriverAvailability.online`
 * (the Ride module's real-time dispatch flag — frozen, not touched here).
 * All safety figures (`getSummary`) are advisory only — nothing in this
 * service blocks a shift/break transition or a ride. */
@Injectable()
export class DriverShiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async startShift(driverUserId: string, context: AuditContext): Promise<DriverShiftDto> {
    const existing = await this.requireNoOpenShift(driverUserId);
    if (existing) {
      throw new ConflictDomainException(
        'A shift is already active — end it before starting a new one',
      );
    }

    const now = new Date();
    const shift = await this.prisma.driverShift.create({
      data: { driverId: driverUserId, startedAt: now, continuousSince: now },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.SHIFT_STARTED,
      { ...context, userId: driverUserId },
      { resource: 'driver_shift', resourceId: shift.id },
    );

    return toDriverShiftDto(shift);
  }

  public async startBreak(driverUserId: string, context: AuditContext): Promise<DriverShiftDto> {
    const shift = await this.requireOpenShift(driverUserId);
    if (shift.status !== DriverShiftStatus.ACTIVE) {
      throw new ConflictDomainException('Shift is already on break');
    }

    const updated = await this.prisma.driverShift.update({
      where: { id: shift.id },
      data: { status: DriverShiftStatus.ON_BREAK, breakStartedAt: new Date() },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.SHIFT_BREAK_STARTED,
      { ...context, userId: driverUserId },
      { resource: 'driver_shift', resourceId: shift.id },
    );

    return toDriverShiftDto(updated);
  }

  public async endBreak(driverUserId: string, context: AuditContext): Promise<DriverShiftDto> {
    const shift = await this.requireOpenShift(driverUserId);
    if (shift.status !== DriverShiftStatus.ON_BREAK || !shift.breakStartedAt) {
      throw new ConflictDomainException('Shift is not currently on break');
    }

    const now = new Date();
    const elapsedBreakSeconds = Math.floor((now.getTime() - shift.breakStartedAt.getTime()) / 1000);

    const updated = await this.prisma.driverShift.update({
      where: { id: shift.id },
      data: {
        status: DriverShiftStatus.ACTIVE,
        breakStartedAt: null,
        continuousSince: now,
        totalBreakSeconds: shift.totalBreakSeconds + elapsedBreakSeconds,
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.SHIFT_BREAK_ENDED,
      { ...context, userId: driverUserId },
      { resource: 'driver_shift', resourceId: shift.id },
    );

    return toDriverShiftDto(updated);
  }

  public async endShift(driverUserId: string, context: AuditContext): Promise<DriverShiftDto> {
    const shift = await this.requireOpenShift(driverUserId);

    const now = new Date();
    const additionalBreakSeconds =
      shift.status === DriverShiftStatus.ON_BREAK && shift.breakStartedAt
        ? Math.floor((now.getTime() - shift.breakStartedAt.getTime()) / 1000)
        : 0;

    const updated = await this.prisma.driverShift.update({
      where: { id: shift.id },
      data: {
        status: DriverShiftStatus.ENDED,
        endedAt: now,
        breakStartedAt: null,
        totalBreakSeconds: shift.totalBreakSeconds + additionalBreakSeconds,
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.SHIFT_ENDED,
      { ...context, userId: driverUserId },
      { resource: 'driver_shift', resourceId: shift.id },
    );

    return toDriverShiftDto(updated);
  }

  public async listOwnShifts(driverUserId: string): Promise<DriverShiftDto[]> {
    const shifts = await this.prisma.driverShift.findMany({
      where: { driverId: driverUserId },
      orderBy: { startedAt: 'desc' },
    });
    return shifts.map(toDriverShiftDto);
  }

  /** Advisory-only safety figures — see class doc comment. */
  public async getSummary(driverUserId: string): Promise<DriverShiftSummaryDto> {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const [activeShift, todaysShifts] = await Promise.all([
      this.prisma.driverShift.findFirst({
        where: {
          driverId: driverUserId,
          status: { in: [DriverShiftStatus.ACTIVE, DriverShiftStatus.ON_BREAK] },
        },
      }),
      this.prisma.driverShift.findMany({
        where: { driverId: driverUserId, startedAt: { gte: startOfToday } },
      }),
    ]);

    const totalMinutesToday = todaysShifts.reduce((sum, shift) => {
      const endMs = (shift.endedAt ?? now).getTime();
      const workedMs = endMs - shift.startedAt.getTime() - shift.totalBreakSeconds * 1000;
      return sum + Math.max(0, workedMs) / MS_PER_MINUTE;
    }, 0);

    const continuousDrivingMinutes =
      activeShift?.status === DriverShiftStatus.ACTIVE
        ? Math.max(0, now.getTime() - activeShift.continuousSince.getTime()) / MS_PER_MINUTE
        : 0;

    return {
      activeShift: activeShift ? toDriverShiftDto(activeShift) : null,
      continuousDrivingMinutes: Math.round(continuousDrivingMinutes),
      totalMinutesToday: Math.round(totalMinutesToday),
      breakReminderDue: continuousDrivingMinutes >= DEFAULT_SHIFT_BREAK_REMINDER_MINUTES,
      dailyLimitExceeded: totalMinutesToday >= DEFAULT_SHIFT_MAX_DAILY_MINUTES,
      fatigueWarning: continuousDrivingMinutes >= DEFAULT_SHIFT_FATIGUE_WARNING_MINUTES,
    };
  }

  public async listShifts(query: ListDriverShiftsQueryDto): Promise<DriverShiftListDto> {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.driverId ? { driverId: query.driverId } : {}),
    };
    const [shifts, total] = await Promise.all([
      this.prisma.driverShift.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.driverShift.count({ where }),
    ]);

    return {
      items: shifts.map(toDriverShiftDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /** Admin-only. Force-ends an abandoned/stuck shift (e.g. a driver left
   * the app open without ending it) — an operational cleanup action, not
   * part of the driver-facing lifecycle. */
  public async forceEndShift(
    shiftId: string,
    adminUserId: string,
    dto: ForceEndDriverShiftDto,
    context: AuditContext,
  ): Promise<DriverShiftDto> {
    const shift = await this.prisma.driverShift.findUnique({ where: { id: shiftId } });
    if (!shift) {
      throw new NotFoundDomainException('Shift not found');
    }
    if (shift.status === DriverShiftStatus.ENDED) {
      throw new ConflictDomainException('Shift has already ended');
    }

    const now = new Date();
    const additionalBreakSeconds =
      shift.status === DriverShiftStatus.ON_BREAK && shift.breakStartedAt
        ? Math.floor((now.getTime() - shift.breakStartedAt.getTime()) / 1000)
        : 0;

    const updated = await this.prisma.driverShift.update({
      where: { id: shiftId },
      data: {
        status: DriverShiftStatus.ENDED,
        endedAt: now,
        breakStartedAt: null,
        totalBreakSeconds: shift.totalBreakSeconds + additionalBreakSeconds,
        forceEndedBy: adminUserId,
        ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes.trim() } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.SHIFT_FORCE_ENDED,
      { ...context, userId: adminUserId },
      { resource: 'driver_shift', resourceId: shift.id, metadata: { driverId: shift.driverId } },
    );

    return toDriverShiftDto(updated);
  }

  private async requireOpenShift(driverUserId: string): Promise<DriverShift> {
    const shift = await this.prisma.driverShift.findFirst({
      where: {
        driverId: driverUserId,
        status: { in: [DriverShiftStatus.ACTIVE, DriverShiftStatus.ON_BREAK] },
      },
      orderBy: { startedAt: 'desc' },
    });
    if (!shift) {
      throw new NotFoundDomainException('No active shift');
    }
    return shift;
  }

  private async requireNoOpenShift(driverUserId: string): Promise<DriverShift | null> {
    return await this.prisma.driverShift.findFirst({
      where: {
        driverId: driverUserId,
        status: { in: [DriverShiftStatus.ACTIVE, DriverShiftStatus.ON_BREAK] },
      },
    });
  }
}
