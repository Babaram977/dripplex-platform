import { createHash, randomInt } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationType,
  Prisma,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { NotificationCenterService } from '../notification-center/notification-center.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import {
  LOYALTY_AUDIT_ACTIONS,
  LOYALTY_MERCHANT_WALLET_REFERENCE_TYPE,
  LOYALTY_POINTS_PER_NAIRA,
  LOYALTY_REDEMPTION_CODE_ALPHABET,
  LOYALTY_REDEMPTION_CODE_LENGTH,
  LOYALTY_REDEMPTION_CODE_TTL_MS,
  LOYALTY_REFERENCE_TYPES,
} from './loyalty.constants';

/** What the holder's app shows once, and never again. */
export interface IssuedRedemptionCode {
  /** The plaintext code. Returned here and nowhere else — only its hash is stored. */
  code: string;
  points: number;
  amount: number;
  expiresAt: string;
}

/** What the merchant sees before deciding to accept a code. */
export interface RedemptionCodePreview {
  points: number;
  amount: number;
  holderName: string;
  expiresAt: string;
}

export interface StoreRedemptionResult {
  points: number;
  amount: number;
  holderName: string;
  /** The merchant's wallet balance after the credit. */
  merchantWalletBalance: number;
  redeemedAt: string;
}

/**
 * DPX-LOYALTY-002 — spending DX points at a merchant's counter.
 *
 * Founder decision (2026-09-11): points buy things in a merchant's physical
 * store, for customers, drivers and riders alike, and the value lands in the
 * merchant's DX wallet — where it can be paid out, or used to settle what the
 * merchant owes DrippleX in commission.
 *
 * The authorisation model is the whole design. The holder generates a code in
 * their own app; the merchant types it in. A merchant never reaches into an
 * account on their own say-so — the obvious alternative, letting a merchant
 * look a customer up by phone number, would mean anyone who knows a phone
 * number can drain that person's balance, and DrippleX identity is
 * phone-primary precisely because phone numbers are not secret.
 *
 * Three things make a code safe to hand over:
 *
 * - It is worth a fixed amount, decided by the holder before it exists. A
 *   merchant cannot take more than was authorised, and the preview shows them
 *   exactly what they are accepting before they accept it.
 * - It expires in ten minutes and can be used once, claimed with a conditional
 *   update so two tills cannot both take it.
 * - Its plaintext is never stored. Only a SHA-256 lives in the database, and a
 *   redemption matches by hashing what the merchant typed.
 */
@Injectable()
export class LoyaltyStoreRedemptionService {
  private readonly logger = new Logger(LoyaltyStoreRedemptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly walletService: WalletService,
    private readonly notifications: NotificationCenterService,
  ) {}

  /**
   * Issues a counter code for a fixed number of points.
   *
   * Any outstanding code is cancelled first. One live code per holder is what
   * stops two codes drawn on the same balance reaching two merchants at once —
   * simpler than putting a hold on the points, and the balance is re-checked at
   * the counter anyway.
   */
  public async issueCode(
    userId: string,
    points: number,
    context: AuditContext = {},
  ): Promise<IssuedRedemptionCode> {
    if (!Number.isInteger(points) || points <= 0) {
      throw new ValidationDomainException('Points must be a positive integer');
    }
    if (points % LOYALTY_POINTS_PER_NAIRA !== 0) {
      throw new ValidationDomainException(
        `Points must be spent in multiples of ${String(LOYALTY_POINTS_PER_NAIRA)} (${String(LOYALTY_POINTS_PER_NAIRA)} points = NGN 1)`,
      );
    }

    const account = await this.prisma.loyaltyAccount.upsert({
      where: { userId },
      update: { deletedAt: null },
      create: { userId },
    });
    if (account.pointsBalance < points) {
      throw new ValidationDomainException('Insufficient loyalty points');
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + LOYALTY_REDEMPTION_CODE_TTL_MS);
    const amount = points / LOYALTY_POINTS_PER_NAIRA;

    const issued = await this.prisma.$transaction(async (tx) => {
      await tx.loyaltyRedemptionCode.updateMany({
        where: { userId, redeemedAt: null, cancelledAt: null },
        data: { cancelledAt: new Date() },
      });
      return await tx.loyaltyRedemptionCode.create({
        data: {
          userId,
          codeHash: this.hash(code),
          points,
          amount: new Prisma.Decimal(amount),
          expiresAt,
        },
      });
    });

    await this.auditService.record(
      LOYALTY_AUDIT_ACTIONS.REDEMPTION_CODE_ISSUED,
      { ...context, userId },
      {
        resource: 'loyalty_redemption_code',
        resourceId: issued.id,
        // Never the code itself, and never its hash: an audit log is read by
        // more people than a redemption needs to be.
        metadata: { points, amount, expiresAt: expiresAt.toISOString() },
      },
    );

    return { code, points, amount, expiresAt: expiresAt.toISOString() };
  }

  /** Revokes the holder's outstanding code, if they have one. */
  public async cancelOutstanding(
    userId: string,
    context: AuditContext = {},
  ): Promise<{ cancelled: number }> {
    const { count } = await this.prisma.loyaltyRedemptionCode.updateMany({
      where: { userId, redeemedAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });

    if (count > 0) {
      await this.auditService.record(
        LOYALTY_AUDIT_ACTIONS.REDEMPTION_CODE_CANCELLED,
        { ...context, userId },
        { resource: 'loyalty_redemption_code', metadata: { cancelled: count } },
      );
    }
    return { cancelled: count };
  }

  /**
   * What a code is worth, without taking it.
   *
   * The merchant needs this before they hand over goods — finding out after the
   * fact that a code was worth ₦2 rather than ₦200 is the merchant's loss.
   */
  public async preview(code: string): Promise<RedemptionCodePreview> {
    const record = await this.requireLiveCode(code);
    const holder = await this.prisma.user.findUniqueOrThrow({
      where: { id: record.userId },
      select: { firstName: true, lastName: true },
    });

    return {
      points: record.points,
      amount: Number(record.amount),
      holderName: `${holder.firstName} ${holder.lastName}`.trim(),
      expiresAt: record.expiresAt.toISOString(),
    };
  }

  /**
   * Takes the points and pays the merchant.
   *
   * The points debit and the merchant's wallet credit commit together, for the
   * same reason self-redemption does: either both happen or neither does. The
   * credit is keyed on the loyalty ledger row that paid for it, against the
   * unique index on (wallet, reference type, reference id), so a retry that
   * reaches the wallet twice pays once.
   */
  public async redeem(
    merchantUserId: string,
    code: string,
    context: AuditContext = {},
  ): Promise<StoreRedemptionResult> {
    const record = await this.requireLiveCode(code);
    const now = new Date();
    const amount = Number(record.amount);

    const creditInput = {
      ownerType: WalletOwnerType.MERCHANT,
      ownerId: merchantUserId,
      amount,
      description: `DX points redeemed in store (${String(record.points)} points)`,
      referenceType: LOYALTY_MERCHANT_WALLET_REFERENCE_TYPE,
      metadata: {
        points: record.points,
        pointsPerNaira: LOYALTY_POINTS_PER_NAIRA,
        redemptionCodeId: record.id,
      },
      context: { ...context, userId: merchantUserId },
    };

    const { outcome, ledgerEntryId } = await this.prisma.$transaction(async (tx) => {
      // Claim the code before anything moves. A second till presenting the same
      // code loses here rather than both being paid.
      const claimed = await tx.loyaltyRedemptionCode.updateMany({
        where: { id: record.id, redeemedAt: null, cancelledAt: null },
        data: { redeemedAt: now, redeemedBy: merchantUserId },
      });
      if (claimed.count !== 1) {
        throw new ValidationDomainException('This code has already been used');
      }

      const account = await tx.loyaltyAccount.findUniqueOrThrow({
        where: { userId: record.userId },
      });
      if (account.pointsBalance < record.points) {
        // The holder spent the balance elsewhere between generating the code
        // and reaching the counter. Refusing rolls the claim back with it.
        throw new ValidationDomainException(
          'This code is no longer covered by the holder’s points balance',
        );
      }

      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { pointsBalance: { decrement: record.points } },
      });

      const entry = await tx.loyaltyLedgerEntry.create({
        data: {
          accountId: account.id,
          points: -record.points,
          reason: `Spent in store for NGN ${String(amount)}`,
          referenceType: LOYALTY_REFERENCE_TYPES.STORE_REDEMPTION,
          referenceId: record.id,
          expiresAt: null,
        },
      });

      const credited = await this.walletService.creditWithin(tx, {
        ...creditInput,
        referenceId: entry.id,
      });

      await tx.loyaltyRedemptionCode.update({
        where: { id: record.id },
        data: { ledgerEntryId: entry.id },
      });

      return { outcome: credited, ledgerEntryId: entry.id };
    });

    await this.walletService.publishCredit({ ...creditInput, referenceId: ledgerEntryId }, outcome);

    await this.auditService.record(
      LOYALTY_AUDIT_ACTIONS.MERCHANT_REDEEMED,
      { ...context, userId: merchantUserId },
      {
        resource: 'loyalty_redemption_code',
        resourceId: record.id,
        metadata: {
          holderUserId: record.userId,
          points: record.points,
          amount,
          walletLedgerEntryId: outcome.ledgerId,
        },
      },
    );

    const holder = await this.prisma.user.findUniqueOrThrow({
      where: { id: record.userId },
      select: { firstName: true, lastName: true },
    });
    await this.notifyHolder(record.userId, record.points, amount);

    return {
      points: record.points,
      amount,
      holderName: `${holder.firstName} ${holder.lastName}`.trim(),
      merchantWalletBalance: outcome.wallet.availableBalance,
      redeemedAt: now.toISOString(),
    };
  }

  private async notifyHolder(userId: string, points: number, amount: number): Promise<void> {
    try {
      await this.notifications.send({
        userId,
        category: NotificationCategory.WALLET,
        channel: NotificationChannel.IN_APP,
        type: NotificationType.LOYALTY_POINTS_SPENT,
        title: 'DX points spent',
        body: `${points.toLocaleString('en-NG')} points (NGN ${amount.toLocaleString('en-NG')}) were used at a DrippleX merchant.`,
      });
    } catch (error) {
      // The holder not getting the notice does not un-spend the points; failing
      // the redemption here would leave the merchant holding goods and no money.
      this.logger.error(
        `Could not notify ${userId} that their points were spent: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * The one lookup. Every failure answers the same way — "not a usable code" —
   * because a merchant terminal is not a place to distinguish "wrong code" from
   * "someone else's code that has already been used".
   */
  private async requireLiveCode(code: string): Promise<{
    id: string;
    userId: string;
    points: number;
    amount: Prisma.Decimal;
    expiresAt: Date;
  }> {
    const normalized = code.trim().toUpperCase();
    if (normalized === '') {
      throw new NotFoundDomainException('That code is not valid or has expired');
    }

    const record = await this.prisma.loyaltyRedemptionCode.findUnique({
      where: { codeHash: this.hash(normalized) },
    });
    if (
      record?.redeemedAt !== null ||
      record.cancelledAt !== null ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      throw new NotFoundDomainException('That code is not valid or has expired');
    }
    return record;
  }

  private generateCode(): string {
    const alphabet = LOYALTY_REDEMPTION_CODE_ALPHABET;
    let code = '';
    for (let index = 0; index < LOYALTY_REDEMPTION_CODE_LENGTH; index += 1) {
      code += alphabet.charAt(randomInt(alphabet.length));
    }
    return code;
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
