import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DriverVerificationTrigger } from '@prisma/client';

import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../../events/domain-events';
import { PrismaService } from '../../prisma/prisma.service';

import { DriverIdentityVerificationService } from './driver-identity-verification.service';

/**
 * Bridges AuthModule's PASSWORD_RESET event to the identity-verification
 * gate without AuthModule depending on DriversModule (which would create a
 * cycle the same way OrderReadySubscriber avoids one for Orders/Delivery).
 * A no-op for any user who isn't a driver.
 */
@Injectable()
export class AccountRecoverySubscriber implements OnModuleInit {
  private readonly logger = new Logger(AccountRecoverySubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly prisma: PrismaService,
    private readonly identityVerificationService: DriverIdentityVerificationService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.PASSWORD_RESET, (event) => this.handle(event));
  }

  public async handle(event: DomainEvent): Promise<void> {
    const userId = typeof event.payload['userId'] === 'string' ? event.payload['userId'] : null;
    if (!userId) return;

    const driverProfile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!driverProfile) return;

    try {
      await this.identityVerificationService.requireVerification(
        userId,
        DriverVerificationTrigger.ACCOUNT_RECOVERY,
        {},
      );
    } catch (error) {
      this.logger.error(
        `Failed to flag account-recovery re-verification for driver ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
