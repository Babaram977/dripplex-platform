import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  DriverShiftStatus,
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@prisma/client';

import { NotificationCenterService } from '../../notification-center/notification-center.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SHIFT_REMINDER_SWEEP_INTERVAL_MS } from '../driver.constants';

import { DriverShiftService } from './driver-shift.service';

/** Driver Slice 2 item 8 — Operational notifications: push versions of the
 * advisory-only safety flags `DriverShiftService.getSummary()` already
 * computes for the driver-portal UI. Same plain-setInterval sweep pattern
 * as RideOfferSweepService/PromotionSweepService (no @nestjs/schedule
 * dependency in this codebase) — polls open shifts and fires each
 * notification once per threshold-crossing, tracked via the
 * `*SentAt`/`*NotifiedAt` fields on `DriverShift` so a driver isn't
 * re-notified every sweep. Purely advisory: this service only sends
 * notifications, it never blocks a shift, a break, or a ride. */
@Injectable()
export class DriverShiftReminderSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DriverShiftReminderSweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shiftService: DriverShiftService,
    private readonly notificationCenter: NotificationCenterService,
  ) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runSweep();
    }, SHIFT_REMINDER_SWEEP_INTERVAL_MS);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  public onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async runSweep(): Promise<number> {
    if (this.running) {
      return 0;
    }

    this.running = true;
    let notified = 0;
    try {
      const activeShifts = await this.prisma.driverShift.findMany({
        where: { status: DriverShiftStatus.ACTIVE },
      });

      for (const shift of activeShifts) {
        const summary = await this.shiftService.getSummary(shift.driverId);

        if (summary.fatigueWarning && !shift.fatigueWarningSentAt) {
          await this.notify(
            shift.driverId,
            NotificationType.SHIFT_FATIGUE_WARNING,
            NotificationPriority.HIGH,
            'Extended driving detected',
            'You have been driving continuously for a while. Please consider taking a break when you can.',
          );
          await this.prisma.driverShift.update({
            where: { id: shift.id },
            data: { fatigueWarningSentAt: new Date() },
          });
          notified += 1;
        }

        if (summary.breakReminderDue && !shift.breakReminderSentAt) {
          await this.notify(
            shift.driverId,
            NotificationType.SHIFT_BREAK_REMINDER,
            NotificationPriority.NORMAL,
            'Time for a break?',
            "You've been driving for a while — consider taking a short break.",
          );
          await this.prisma.driverShift.update({
            where: { id: shift.id },
            data: { breakReminderSentAt: new Date() },
          });
          notified += 1;
        }

        if (summary.dailyLimitExceeded && !shift.dailyLimitNotifiedAt) {
          await this.notify(
            shift.driverId,
            NotificationType.SHIFT_DAILY_LIMIT_EXCEEDED,
            NotificationPriority.HIGH,
            'Daily driving hours exceeded',
            "You've exceeded the recommended daily driving hours today.",
          );
          await this.prisma.driverShift.update({
            where: { id: shift.id },
            data: { dailyLimitNotifiedAt: new Date() },
          });
          notified += 1;
        }
      }

      if (notified > 0) {
        this.logger.log(`Shift reminder sweep: notified=${String(notified)}`);
      }
      return notified;
    } finally {
      this.running = false;
    }
  }

  private async notify(
    driverId: string,
    type: NotificationType,
    priority: NotificationPriority,
    title: string,
    body: string,
  ): Promise<void> {
    await this.notificationCenter.send({
      userId: driverId,
      category: NotificationCategory.SYSTEM,
      channel: NotificationChannel.IN_APP,
      type,
      priority,
      title,
      body,
    });
  }
}
