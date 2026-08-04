import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DriverVerificationTrigger } from '@prisma/client';

import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../../events/domain-events';
import { PrismaService } from '../../prisma/prisma.service';

import { DriverIdentityVerificationService } from './driver-identity-verification.service';

/**
 * DPX-DS-001 — bridges AuthModule's PASSWORD_CHANGED and WalletModule's
 * WALLET_PIN_CHANGED events to the identity-verification gate, the same
 * way AccountRecoverySubscriber bridges PASSWORD_RESET. A no-op for any
 * user who isn't a driver.
 */
@Injectable()
export class CredentialChangeSubscriber implements OnModuleInit {
  private readonly logger = new Logger(CredentialChangeSubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly prisma: PrismaService,
    private readonly identityVerificationService: DriverIdentityVerificationService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.PASSWORD_CHANGED, (event) => this.handle(event));
    this.eventBus.on(DOMAIN_EVENTS.WALLET_PIN_CHANGED, (event) => this.handle(event));
  }

  public async handle(event: DomainEvent): Promise<void> {
    const userId = typeof event.payload['userId'] === 'string' ? event.payload['userId'] : null;
    if (!userId) return;

    const driverProfile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!driverProfile) return;

    try {
      await this.identityVerificationService.requireVerification(
        userId,
        DriverVerificationTrigger.CREDENTIAL_CHANGE,
        {},
      );
    } catch (error) {
      this.logger.error(
        `Failed to flag credential-change re-verification for driver ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
