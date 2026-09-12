import { createHash, randomInt } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import {
  LoyaltyLedgerEntryType,
  NotificationCategory,
  NotificationChannel,
  NotificationType,
  Prisma,
  PromotionDomain,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { NotificationCenterService } from '../notification-center/notification-center.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { WalletService } from '../wallet/wallet.service';

import { LoyaltySettingsService } from './loyalty-settings.service';
import {
  LOYALTY_AUDIT_ACTIONS,
  LOYALTY_MERCHANT_WALLET_REFERENCE_TYPE,
  LOYALTY_REDEMPTION_CODE_ALPHABET,
  LOYALTY_REDEMPTION_CODE_LENGTH,
  LOYALTY_REDEMPTION_CODE_TTL_MS,
  LOYALTY_REFERENCE_TYPES,
  LOYALTY_STORE_COUPON_REFERENCE_TYPE,
} from './loyalty.constants';

/** What the holder's app shows once, and never again. */
export interface IssuedRedemptionCode {
  /** The plaintext code. Returned here and nowhere else — only its hash is stored. */
  code: string;
  points: number;
  amount: number;
  /** A coupon the holder chose to spend at the counter, if any. */
  couponCode: string | null;
  expiresAt: string;
}

/** What the merchant sees before deciding to accept a code. */
export interface RedemptionCodePreview {
  points: number;
  amount: number;
  couponCode: string | null;
  holderName: string;
  expiresAt: string;
}

export interface StoreRedemptionResult {
  points: number;
  /** Naira credited from the points the holder spent. */
  amount: number;
  couponCode: string | null;
  /** Naira credited to cover a coupon discount DrippleX funded. */
  couponDiscount: number;
  /** Everything credited to the merchant for this code. */
  totalCredited: number;
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
    private readonly promotions: PromotionsService,
    private readonly settings: LoyaltySettingsService,
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
    input: { points?: number; couponCode?: string },
    context: AuditContext = {},
  ): Promise<IssuedRedemptionCode> {
    const points = input.points ?? 0;
    const couponCode = input.couponCode?.trim().toUpperCase();

    if (points === 0 && (couponCode === undefined || couponCode === '')) {
      throw new ValidationDomainException('Give the code some points to spend, a coupon, or both');
    }
    if (!Number.isInteger(points) || points < 0) {
      throw new ValidationDomainException('Points must be a whole number');
    }

    // DPX-LOYALTY-005 — the conversion rate is an Operations setting now, read
    // here rather than assumed, so this path follows a re-pricing without a
    // deployment. The in-store switch is seeded on because the founder's
    // instruction was explicitly not to change in-store spending, and a switch
    // that starts on does not. The rate itself is 100 since the ruling of
    // 2026-09-12, which doubled what the same points buy at a counter.
    const setting = await this.settings.getEffective();
    if (points > 0 && !setting.storeRedemptionEnabled) {
      throw new ValidationDomainException(
        'DX Points cannot be spent in store at the moment. A coupon can still be presented.',
      );
    }
    if (points % setting.pointsPerNaira !== 0) {
      throw new ValidationDomainException(
        `Points must be spent in multiples of ${String(setting.pointsPerNaira)} (${String(setting.pointsPerNaira)} points = NGN 1)`,
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
    const amount = points / setting.pointsPerNaira;

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
          couponCode: couponCode ?? null,
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
        metadata: {
          points,
          amount,
          couponCode: couponCode ?? null,
          expiresAt: expiresAt.toISOString(),
        },
      },
    );

    return {
      code,
      points,
      amount,
      couponCode: couponCode ?? null,
      expiresAt: expiresAt.toISOString(),
    };
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
      couponCode: record.couponCode,
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
    options: { billAmount?: number } = {},
    context: AuditContext = {},
  ): Promise<StoreRedemptionResult> {
    const record = await this.requireLiveCode(code);
    const now = new Date();
    const amount = Number(record.amount);

    if (record.couponCode !== null && options.billAmount === undefined) {
      // A percentage coupon is meaningless without a bill to take it off, and
      // guessing one would either short the merchant or overpay them.
      throw new ValidationDomainException(
        'This code carries a coupon. Enter the bill total so the discount can be worked out.',
      );
    }

    const creditInput = {
      ownerType: WalletOwnerType.MERCHANT,
      ownerId: merchantUserId,
      amount,
      description: `DX points redeemed in store (${String(record.points)} points)`,
      referenceType: LOYALTY_MERCHANT_WALLET_REFERENCE_TYPE,
      metadata: {
        points: record.points,
        // The rate the code was issued at, recovered from what was actually
        // promised rather than read fresh — a re-pricing between a customer
        // showing a code and a merchant typing it must not change the payout.
        pointsPerNaira: record.points === 0 ? null : record.points / Number(record.amount),
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

      if (record.points === 0) {
        // A coupon-only code. The claim above is the whole of the points side:
        // there is nothing to burn and nothing to credit, and a zero-naira
        // wallet movement is refused by design.
        return { outcome: null, ledgerEntryId: null };
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
          type: LoyaltyLedgerEntryType.REDEEMED,
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

    if (outcome !== null) {
      await this.walletService.publishCredit(
        { ...creditInput, referenceId: ledgerEntryId },
        outcome,
      );
    }

    // The coupon, after the points. Deliberately outside the points
    // transaction: a coupon that turns out to be expired or over its limit
    // must not un-spend points the holder genuinely authorised and the
    // merchant has already been paid for. `redeemForReference` enforces the
    // promotion's own rules and is keyed on this code's id, so it cannot pay
    // twice.
    const coupon = await this.applyCoupon(record, merchantUserId, options.billAmount ?? 0, context);

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
          couponCode: record.couponCode,
          walletLedgerEntryId: outcome?.ledgerId ?? null,
        },
      },
    );

    const holder = await this.prisma.user.findUniqueOrThrow({
      where: { id: record.userId },
      select: { firstName: true, lastName: true },
    });
    if (record.points > 0) {
      await this.notifyHolder(record.userId, record.points, amount);
    }

    return {
      points: record.points,
      amount,
      couponCode: record.couponCode,
      couponDiscount: coupon.discount,
      totalCredited: Math.round((amount + coupon.discount) * 100) / 100,
      holderName: `${holder.firstName} ${holder.lastName}`.trim(),
      merchantWalletBalance: coupon.walletBalance ?? outcome?.wallet.availableBalance ?? 0,
      redeemedAt: now.toISOString(),
    };
  }

  /**
   * Applies the coupon riding on this code and pays the merchant for it.
   *
   * Founder decision 2026-09-11: **DrippleX funds the in-store discount** and
   * settles the merchant the same way it settles a points redemption — into
   * their DX wallet. The merchant gives the customer money off at the till and
   * is made whole here, so an in-store coupon costs them nothing.
   *
   * Wallet-credit promotions are refused rather than paid: those put money in
   * the *customer's* wallet, which is not a discount on a bill and would have
   * the merchant credited for something the customer never saved at the
   * counter.
   */
  private async applyCoupon(
    record: { id: string; userId: string; couponCode: string | null },
    merchantUserId: string,
    billAmount: number,
    context: AuditContext,
  ): Promise<{ discount: number; walletBalance: number | null }> {
    if (record.couponCode === null) {
      return { discount: 0, walletBalance: null };
    }

    const redeemed = await this.promotions.redeemForReference(
      {
        userId: record.userId,
        domain: PromotionDomain.MERCHANT,
        subtotal: billAmount,
        merchantId: merchantUserId,
        couponCode: record.couponCode,
        referenceType: LOYALTY_STORE_COUPON_REFERENCE_TYPE,
        referenceId: record.id,
      },
      { ...context, userId: record.userId },
    );

    if (redeemed.creditAmount > 0 && redeemed.discountAmount <= 0) {
      throw new ValidationDomainException(
        'That coupon pays wallet credit rather than money off a bill, so it cannot be used at a counter',
      );
    }
    if (redeemed.discountAmount <= 0) {
      return { discount: 0, walletBalance: null };
    }

    const wallet = await this.walletService.credit({
      ownerType: WalletOwnerType.MERCHANT,
      ownerId: merchantUserId,
      amount: redeemed.discountAmount,
      description: `Coupon ${record.couponCode} redeemed in store`,
      referenceType: LOYALTY_STORE_COUPON_REFERENCE_TYPE,
      referenceId: record.id,
      metadata: { couponCode: record.couponCode, billAmount },
      context: { ...context, userId: merchantUserId },
    });

    return {
      discount: redeemed.discountAmount,
      walletBalance: wallet.availableBalance,
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
    couponCode: string | null;
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
