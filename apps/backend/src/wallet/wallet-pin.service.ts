import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';

import { WALLET_AUDIT_ACTIONS, WALLET_PIN_LENGTH } from './wallet.constants';

/**
 * A hashed PIN gating withdrawal requests — no PIN infrastructure existed
 * anywhere in the platform before this (see docs/WALLET-004-WITHDRAW-DESIGN.md).
 * bcrypt, same salt-rounds config the password flows already use; no new
 * hashing scheme introduced. A PIN can only be set once here — Slice 5
 * (Wallet Security) owns the "change PIN" flow on top of these primitives.
 */
@Injectable()
export class WalletPinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly auditService: AuditService,
    private readonly eventBus: DomainEventBus,
  ) {}

  public async hasPin(userId: string): Promise<boolean> {
    const row = await this.prisma.walletPin.findUnique({ where: { userId } });
    return row !== null;
  }

  public async set(userId: string, pin: string, context?: AuditContext): Promise<void> {
    if (pin.length !== WALLET_PIN_LENGTH || !/^[0-9]+$/.test(pin)) {
      throw new ValidationDomainException(
        `PIN must be exactly ${String(WALLET_PIN_LENGTH)} digits`,
      );
    }
    const existing = await this.prisma.walletPin.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictDomainException('A wallet PIN is already set');
    }

    const pinHash = await bcrypt.hash(pin, this.appConfig.bcryptSaltRounds);
    await this.prisma.walletPin.create({ data: { userId, pinHash } });

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.PIN_SET,
      { ...(context ?? {}), userId },
      { resource: 'wallet_pin', resourceId: userId },
    );
  }

  /** Throws ValidationDomainException if the PIN is missing or wrong —
   * callers (withdrawal creation) should let this propagate as a 4xx. */
  public async verify(userId: string, pin: string): Promise<void> {
    const row = await this.prisma.walletPin.findUnique({ where: { userId } });
    if (!row) {
      throw new ValidationDomainException('No wallet PIN set — set one before withdrawing');
    }
    const valid = await bcrypt.compare(pin, row.pinHash);
    if (!valid) {
      throw new ValidationDomainException('Incorrect PIN');
    }
  }

  /** Wallet Security's "Change PIN" — requires the current PIN, same
   * verify-then-replace discipline as a password change. */
  public async change(
    userId: string,
    currentPin: string,
    newPin: string,
    context?: AuditContext,
  ): Promise<void> {
    if (newPin.length !== WALLET_PIN_LENGTH || !/^[0-9]+$/.test(newPin)) {
      throw new ValidationDomainException(
        `PIN must be exactly ${String(WALLET_PIN_LENGTH)} digits`,
      );
    }
    await this.verify(userId, currentPin);

    const pinHash = await bcrypt.hash(newPin, this.appConfig.bcryptSaltRounds);
    await this.prisma.walletPin.update({ where: { userId }, data: { pinHash } });

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.PIN_CHANGED,
      { ...(context ?? {}), userId },
      { resource: 'wallet_pin', resourceId: userId },
    );
    // DPX-DS-001: a credential change is a driver identity-verification
    // risk signal — minimal, single-line touch to this frozen module under
    // the Freeze Rule's critical-security-patch exception.
    await this.eventBus.emit(DOMAIN_EVENTS.WALLET_PIN_CHANGED, { userId });
  }
}
