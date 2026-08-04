import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';
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
}
