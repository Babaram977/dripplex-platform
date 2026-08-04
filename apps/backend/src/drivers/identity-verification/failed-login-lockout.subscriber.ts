import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DriverVerificationTrigger } from '@prisma/client';

import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../../events/domain-events';
import { PrismaService } from '../../prisma/prisma.service';

import { DriverIdentityVerificationService } from './driver-identity-verification.service';

/**
 * DPX-DS-001 — bridges AuthModule's LOGIN_LOCKED event (per-email lockout
 * from LoginAttemptService, not the per-IP lockout) to the
 * identity-verification gate. Fired at lockout time, not at the next
 * successful login, mirroring AccountRecoverySubscriber. A no-op for any
 * account that isn't a driver.
 */
@Injectable()
export class FailedLoginLockoutSubscriber implements OnModuleInit {
  private readonly logger = new Logger(FailedLoginLockoutSubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly prisma: PrismaService,
    private readonly identityVerificationService: DriverIdentityVerificationService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.LOGIN_LOCKED, (event) => this.handle(event));
  }

  public async handle(event: DomainEvent): Promise<void> {
    const email = typeof event.payload['email'] === 'string' ? event.payload['email'] : null;
    if (!email) return;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: user.id },
    });
    if (!driverProfile) return;

    try {
      await this.identityVerificationService.requireVerification(
        user.id,
        DriverVerificationTrigger.FAILED_LOGIN_LOCKOUT,
        {},
      );
    } catch (error) {
      this.logger.error(
        `Failed to flag failed-login-lockout re-verification for driver ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
