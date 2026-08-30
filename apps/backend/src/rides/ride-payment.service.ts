import { Inject, Injectable } from '@nestjs/common';
import {
  CommissionOwnerType,
  RidePaymentMethod,
  RidePaymentStatus,
  RideStatus,
  TransactionStatus,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  COMMISSION_REFERENCE_TYPES,
  COMMISSION_RIDE_EARNING_DEBT_REFERENCE_TYPE,
  COMMISSION_RIDE_REVERSAL_REFERENCE_TYPE,
  DEFAULT_PLATFORM_COMMISSION_RATE,
} from '../commercial/commercial.constants';
import { CommissionAccountService } from '../commercial/commission-account.service';
import { PlatformCommissionSettingsService } from '../commercial/platform-commission-settings.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { FleetsService } from '../fleets/fleets.service';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../notifications/notification.service';
import {
  PAYMENT_PROVIDER_ADAPTERS,
  type PaymentProviderAdapter,
} from '../payments/providers/payment-provider.adapter';
import { PrismaService } from '../prisma/prisma.service';
import { PLATFORM_WALLET_OWNER_ID } from '../wallet/wallet.constants';
import { WalletService } from '../wallet/wallet.service';

import { RIDE_EVENTS_PUBLISHER, type RideEventsPublisher } from './ride-events.publisher';
import { RIDE_AUDIT_ACTIONS, RIDE_WALLET_REFERENCE_TYPES } from './ride.constants';
import { toRideDto } from './ride.mapper';

import type { InitiateRidePaymentResponse, RideDto } from '@dripplex/types';
import type { PaymentProvider, Ride } from '@prisma/client';

// OPAY is intentionally omitted: a real OpayProvider adapter does not exist yet
// (it throws NotImplementedException), so OPay is safe-disabled from customer
// ride selection per the founder decision recorded in DPX-DRIVER-013 §G. The
// RidePaymentMethod enum value is deliberately preserved for DB/wallet/order
// compatibility; keeping OPAY out of both constants below means an OPAY ride
// request is cleanly rejected at initiation (400) via the RIDE_PAYMENT_METHOD_TO_PROVIDER
// guard, rather than reaching the adapter and 501-ing in production. Restore both
// entries once a working adapter lands.
const GATEWAY_METHODS: RidePaymentMethod[] = [
  RidePaymentMethod.PAYSTACK,
  RidePaymentMethod.FLUTTERWAVE,
];

const RIDE_PAYMENT_METHOD_TO_PROVIDER: Partial<Record<RidePaymentMethod, PaymentProvider>> = {
  [RidePaymentMethod.PAYSTACK]: 'PAYSTACK',
  [RidePaymentMethod.FLUTTERWAVE]: 'FLUTTERWAVE',
};

interface FareSplit {
  platformCommission: number;
  driverEarning: number;
  /** The commission rate this split was computed at (snapshotted onto the ride). */
  platformCommissionRate: number;
  /**
   * The fare before any coupon — `ride.totalFare + ride.promoDiscount`. This,
   * not the discounted fare, is what the driver is paid on and what commission
   * is charged on. See `computeSplit`.
   */
  grossFare: number;
  /** The coupon the customer redeemed, funded by the platform. Zero for most rides. */
  promoDiscount: number;
}

/**
 * Post-completion ride payment, per the locked flow: no money moves during
 * the trip. A ride reaches COMPLETED with a known final fare (RIDE-002.6),
 * then the customer picks a payment method — Cash, OPay, Wallet, or Card
 * (Paystack/Flutterwave) — exactly like Uber/Bolt's payment screen. Only
 * then does settlement happen: the platform wallet is the clearinghouse
 * every fare passes through, with the driver's share transferred out and
 * the commission left behind. See docs/RIDE-002.7-WALLET-PAYMENT-DESIGN.md.
 */
@Injectable()
export class RidePaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifications: NotificationService,
    @Inject(RIDE_EVENTS_PUBLISHER)
    private readonly events: RideEventsPublisher,
    @Inject(PAYMENT_PROVIDER_ADAPTERS)
    private readonly providers: PaymentProviderAdapter[],
    private readonly eventBus: DomainEventBus,
    private readonly commissionAccounts: CommissionAccountService,
    private readonly platformCommissionSettings: PlatformCommissionSettingsService,
    private readonly fleets: FleetsService,
  ) {}

  public async initiatePayment(
    customerId: string,
    rideId: string,
    method: RidePaymentMethod,
    callbackUrl: string | undefined,
    context: AuditContext,
  ): Promise<InitiateRidePaymentResponse> {
    if (method === RidePaymentMethod.WALLET) {
      const ride = await this.payWithWallet(customerId, rideId, context);
      return { ride };
    }
    if (method === RidePaymentMethod.CASH) {
      const ride = await this.selectCash(customerId, rideId, context);
      return { ride };
    }
    return await this.initiateGatewayPayment(customerId, rideId, method, callbackUrl, context);
  }

  /**
   * The gateway's side of a card-paid fare.
   *
   * `verifyPayment` only runs when the passenger comes back to the app; a
   * passenger who stops at the gateway's success page is charged and the ride
   * is never settled. The webhook always arrives. Returns null when the
   * reference is not a ride payment at all.
   */
  public async completeGatewayPaymentByReference(
    reference: string,
    context: AuditContext,
  ): Promise<RideDto | null> {
    const transaction = await this.prisma.ridePaymentTransaction.findUnique({
      where: { providerReference: reference },
      include: { ride: true },
    });
    if (!transaction) {
      return null;
    }
    return await this.verifyPayment(
      transaction.ride.customerId,
      transaction.rideId,
      reference,
      context,
    );
  }

  public async verifyPayment(
    customerId: string,
    rideId: string,
    reference: string | undefined,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requireOwnedRide(customerId, rideId);
    if (ride.paymentStatus === RidePaymentStatus.PAID) {
      return toRideDto(ride);
    }
    if (!ride.paymentMethod || !GATEWAY_METHODS.includes(ride.paymentMethod)) {
      throw new ValidationDomainException('Ride does not have a pending gateway payment');
    }

    const transaction = reference
      ? await this.prisma.ridePaymentTransaction.findFirst({
          where: { providerReference: reference, rideId: ride.id },
        })
      : await this.prisma.ridePaymentTransaction.findFirst({
          where: { rideId: ride.id },
          orderBy: { createdAt: 'desc' },
        });
    if (!transaction) {
      throw new NotFoundDomainException('Ride payment transaction not found');
    }

    const adapter = this.getAdapter(transaction.provider);
    const verification = await adapter.verifyPayment({ reference: transaction.providerReference });

    if (!verification.success) {
      await this.prisma.ridePaymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.FAILED,
          gatewayResponse: verification.gatewayResponse ?? {},
        },
      });
      await this.markFailed(ride, context);
      await this.notifyPaymentOutcome(ride, false);
      throw new ValidationDomainException('Payment verification failed');
    }

    // Claim the transaction row atomically before any money moves. markPaid()
    // guards the ride's PAID transition, but the capture and driver payout
    // below run before it — two concurrent settlements (now that the gateway
    // webhook settles the same ride as the customer's return-to-app verify)
    // could both credit before either claimed the ride. The loser stops here.
    const claimed = await this.prisma.ridePaymentTransaction.updateMany({
      where: { id: transaction.id, status: { not: TransactionStatus.SUCCESS } },
      data: {
        status: TransactionStatus.SUCCESS,
        verifiedAt: new Date(),
        paidAt: verification.paidAt ?? new Date(),
        providerTransactionId: verification.providerTransactionId ?? null,
        gatewayResponse: verification.gatewayResponse ?? {},
      },
    });
    if (claimed.count === 0) {
      return toRideDto(await this.prisma.ride.findUniqueOrThrow({ where: { id: ride.id } }));
    }

    const rate = await this.effectiveCommissionRate(ride);
    const split = this.computeSplit(ride, rate);
    await this.captureIntoPlatformWallet(ride, context);
    await this.payoutDriver(ride, split, context);
    return await this.markPaid(ride, ride.paymentMethod, split, context);
  }

  /**
   * The platform commission rate for one ride.
   *
   * Zero when the driver rides for a fleet. Founder decision, 2026-08-30:
   * "remove the driver 10% for fleet drivers". DrippleX's commercial
   * counterparty for a fleet trip is the fleet, which is charged its own
   * negotiated or banded rate on the fare at month end — charging the driver
   * as well would take twice from one trip, and the driver's pay is a matter
   * between them and the fleet owner, not DrippleX.
   *
   * Resolved per ride rather than stored on the driver, because a driver can
   * join or leave a fleet: what matters is who they rode for when the trip
   * settled, and the rate is snapshotted onto the ride either way.
   */
  private async effectiveCommissionRate(ride: Ride): Promise<number> {
    if (ride.driverId !== null) {
      const membership = await this.fleets.fleetForUser(ride.driverId);
      if (membership !== null) return 0;
    }
    return await this.platformCommissionSettings.getEffectiveRate();
  }

  public async confirmCash(
    driverId: string,
    rideId: string,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requireCashConfirmableRide(driverId, rideId);
    const rate = await this.effectiveCommissionRate(ride);
    const split = this.computeSplit(ride, rate);

    // DPX-COMMERCIAL-001 Slice 4 — cash never enters the digital ledger,
    // the driver already holds it physically, so there is nothing to
    // credit to Wallet. What DrippleX is owed is the platform commission,
    // which now accrues onto the driver's CommissionAccount instead of
    // being audit-only (the gap RIDE-002.7's design doc flagged and
    // deferred — see docs/DPX-COMMERCIAL-001-SLICE-4-RIDE-CASH.md).
    await this.accrueDriverCommissionWithRetry({
      ownerType: CommissionOwnerType.DRIVER,
      ownerId: driverId,
      amount: split.platformCommission,
      referenceType: COMMISSION_REFERENCE_TYPES.RIDE,
      referenceId: ride.id,
      description: `Commission owed for ride ${ride.id} (cash)`,
    });

    // DPX-PROMO-FUNDING — a cash driver is handed only the *discounted* fare,
    // so unlike the wallet path there is no payout leg to absorb the coupon.
    // The platform's contribution has to reach them as a real credit, or the
    // driver funds the promotion out of the cash they were short-changed.
    //
    // Their position after this: they hold `totalFare` in cash, owe
    // `platformCommission` on it, and receive `promoDiscount` — netting to
    // `grossFare - platformCommission`, exactly the wallet-path driver's
    // earning for the same trip. Cash and wallet drivers are paid identically.
    await this.fundDriverPromotion(ride, driverId, split, context);

    // markPaid() atomically claims the PAID transition and throws
    // ConflictDomainException if a concurrent confirmCash() already won it.
    // Recording the CASH_CONFIRMED audit and emitting RIDE_CASH_CONFIRMED only
    // *after* it succeeds guarantees they fire once — for the single call that
    // actually settles the ride — never once per racing caller. The accrual
    // above is a safe no-op on the losing path: its
    // (accountId, 'ride', rideId) ledger guard dedupes the second attempt, so
    // exactly one commission entry exists regardless of which call created it.
    const paid = await this.markPaid(ride, RidePaymentMethod.CASH, split, context);

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.CASH_CONFIRMED,
      { ...context, userId: driverId },
      {
        resource: 'ride',
        resourceId: ride.id,
        metadata: {
          totalFare: Number(ride.totalFare),
          driverEarning: split.driverEarning,
          platformCommission: split.platformCommission,
          creditedVia: 'commission_account',
        },
      },
    );
    await this.eventBus.emit(DOMAIN_EVENTS.RIDE_CASH_CONFIRMED, {
      driverId,
      rideId: ride.id,
      totalFare: String(ride.totalFare),
    });
    return paid;
  }

  /**
   * DPX-D4 — admin/operations-initiated FULL refund of a settled (PAID) ride.
   *
   * Money moves are idempotent per (wallet/account, referenceType, ride.id)
   * and run BEFORE the guarded PAID -> REFUNDED transition, so a mid-refund
   * failure leaves the ride PAID and a retry converges without double-moving
   * money — the same shape as D7's confirmCash(). The optimistic transition is
   * the exactly-once gate for the audit record and the RIDE_REFUNDED event: a
   * concurrent/duplicate refund that already won leaves count === 0 and is
   * rejected, its own money moves having been idempotent no-ops.
   *
   * By payment method:
   *  - WALLET / gateway (PAYSTACK/FLUTTERWAVE): the fare was captured into the
   *    platform wallet at settlement, so the refund mirrors settlement's four
   *    wallet legs — release the capture from the platform and credit the
   *    customer's Dx Wallet, then claw the driver's earning back to the
   *    platform. Gateway rides refund to the Dx Wallet, never the PSP (founder
   *    decision — no gateway refund adapters). If the driver's wallet can't
   *    cover the clawback, the shortfall is recorded as a recoverable driver
   *    liability rather than silently failing.
   *  - CASH: no wallet money ever moved (the driver holds the cash), so the
   *    refund only reverses the driver's accrued commission liability; no
   *    digital customer refund is manufactured.
   *
   * RIDE_PLATFORM_COMMISSION_RATE is untouched — the platform's commission is
   * given back through the wallet legs (wallet/gateway) or reverseAccrual
   * (cash), never by recomputing a rate.
   */
  public async refundRide(
    adminUserId: string,
    rideId: string,
    reason: string,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requireRefundableRide(rideId);
    const method = ride.paymentMethod;
    if (method === null) {
      throw new ValidationDomainException('Ride has no recorded payment method to refund');
    }
    const refundContext: AuditContext = { ...context, userId: adminUserId };

    let customerRefundAmount = 0;
    if (method === RidePaymentMethod.CASH) {
      await this.refundCashRide(ride, reason, refundContext);
    } else {
      customerRefundAmount = await this.refundWalletCapturedRide(ride, reason, refundContext);
    }

    // Exactly-once gate: atomically claim the PAID -> REFUNDED transition.
    const claimed = await this.prisma.ride.updateMany({
      where: { id: ride.id, paymentStatus: RidePaymentStatus.PAID },
      data: { paymentStatus: RidePaymentStatus.REFUNDED },
    });
    if (claimed.count !== 1) {
      throw new ConflictDomainException('Ride has already been refunded');
    }

    // Gateway rides carry a settled RidePaymentTransaction row — mark it
    // REFUNDED too so the transaction record reflects the reversal (no-op for
    // wallet/cash rides, which have no such row).
    await this.prisma.ridePaymentTransaction.updateMany({
      where: { rideId: ride.id, status: TransactionStatus.SUCCESS },
      data: { status: TransactionStatus.REFUNDED },
    });

    const refreshed = await this.prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });

    await this.auditService.record(RIDE_AUDIT_ACTIONS.REFUNDED, refundContext, {
      resource: 'ride',
      resourceId: ride.id,
      metadata: {
        method,
        reason,
        totalFare: Number(ride.totalFare),
        customerRefundAmount,
        driverEarning: ride.driverEarning !== null ? Number(ride.driverEarning) : null,
        platformCommission:
          ride.platformCommission !== null ? Number(ride.platformCommission) : null,
      },
    });

    // Emitted for every refunded ride (founder decision D7 of the D4 policy —
    // preserve the existing RIDE_REFUNDED consumer). `amount` is included only
    // when the customer actually received a digital refund (wallet/gateway), so
    // a CASH refund — which moves no customer money — does not notify a bogus
    // "₦0 refunded".
    await this.eventBus.emit(DOMAIN_EVENTS.RIDE_REFUNDED, {
      rideId: ride.id,
      customerId: ride.customerId,
      ...(customerRefundAmount > 0 ? { amount: String(customerRefundAmount) } : {}),
      reason,
    });

    return toRideDto(refreshed);
  }

  /**
   * 100% of the tip goes to the driver — no platform commission, so unlike
   * fare settlement this never routes through the platform wallet. Wallet
   * and gateway payments move a real debit+credit pair; cash payments only
   * record the figure, since the passenger hands the cash to the driver
   * directly and it never enters the digital ledger (same treatment as the
   * cash fare itself).
   */
  public async tipDriver(
    customerId: string,
    rideId: string,
    amount: number,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requireOwnedRide(customerId, rideId);
    if (ride.paymentStatus !== RidePaymentStatus.PAID) {
      throw new ValidationDomainException('Ride must be paid before it can be tipped');
    }
    if (ride.tipAmount !== null) {
      throw new ConflictDomainException('Ride has already been tipped');
    }
    if (!ride.driverId) {
      throw new ValidationDomainException('Ride has no assigned driver to tip');
    }

    if (ride.paymentMethod !== RidePaymentMethod.CASH) {
      await this.walletService.debit({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: customerId,
        amount,
        referenceType: RIDE_WALLET_REFERENCE_TYPES.TIP,
        referenceId: ride.id,
        description: `Ride tip (${ride.id})`,
        context,
      });
      await this.walletService.credit({
        ownerType: WalletOwnerType.DRIVER,
        ownerId: ride.driverId,
        amount,
        referenceType: RIDE_WALLET_REFERENCE_TYPES.TIP,
        referenceId: ride.id,
        description: `Ride tip (${ride.id})`,
        context,
      });
    }

    const updated = await this.prisma.ride.update({
      where: { id: ride.id },
      data: { tipAmount: amount },
    });

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.TIP_ADDED,
      { ...context, userId: customerId },
      { resource: 'ride', resourceId: ride.id, metadata: { amount, method: ride.paymentMethod } },
    );

    const driver = await this.prisma.user.findUnique({ where: { id: ride.driverId } });
    if (driver?.email) {
      await this.notifications.notifyRideEarning({
        email: driver.email,
        rideId: ride.id,
        amount,
        currency: 'NGN',
      });
    }

    return toRideDto(updated);
  }

  private async payWithWallet(
    customerId: string,
    rideId: string,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requirePayableRide(customerId, rideId);
    const rate = await this.effectiveCommissionRate(ride);
    const split = this.computeSplit(ride, rate);

    try {
      await this.walletService.debit({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: customerId,
        amount: ride.totalFare,
        referenceType: RIDE_WALLET_REFERENCE_TYPES.FARE,
        referenceId: ride.id,
        description: `Ride fare (${ride.id})`,
        context,
      });
    } catch (error) {
      await this.markFailed(ride, context);
      await this.notifyPaymentOutcome(ride, false);
      throw error;
    }

    await this.captureIntoPlatformWallet(ride, context);
    await this.payoutDriver(ride, split, context);
    return await this.markPaid(ride, RidePaymentMethod.WALLET, split, context);
  }

  private async selectCash(
    customerId: string,
    rideId: string,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requirePayableRide(customerId, rideId);
    const updated = await this.prisma.ride.update({
      where: { id: ride.id },
      data: { paymentMethod: RidePaymentMethod.CASH },
    });
    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.PAYMENT_INITIATED,
      { ...context, userId: customerId },
      { resource: 'ride', resourceId: ride.id, metadata: { method: 'CASH' } },
    );
    return toRideDto(updated);
  }

  private async initiateGatewayPayment(
    customerId: string,
    rideId: string,
    method: RidePaymentMethod,
    callbackUrl: string | undefined,
    context: AuditContext,
  ): Promise<InitiateRidePaymentResponse> {
    const ride = await this.requirePayableRide(customerId, rideId);
    const provider = RIDE_PAYMENT_METHOD_TO_PROVIDER[method];
    if (!provider) {
      throw new ValidationDomainException(`Unsupported ride payment method: ${method}`);
    }
    const adapter = this.getAdapter(provider);

    const customer = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!customer?.email) {
      throw new ValidationDomainException('Customer email is required for payment');
    }

    const reference = `RIDE-${ride.id.slice(0, 8)}-${String(Date.now())}`;
    const init = await adapter.initializePayment({
      email: customer.email,
      amount: Number(ride.totalFare),
      currency: 'NGN',
      reference,
      orderId: ride.id,
      orderNumber: ride.id,
      ...(callbackUrl !== undefined ? { callbackUrl } : {}),
    });

    const transaction = await this.prisma.ridePaymentTransaction.create({
      data: {
        rideId: ride.id,
        provider,
        providerReference: init.reference,
        amount: ride.totalFare,
        authorizationUrl: init.authorizationUrl,
        accessCode: init.accessCode ?? null,
        providerTransactionId: init.providerTransactionId ?? null,
        gatewayResponse: init.raw ?? {},
      },
    });

    const updated = await this.prisma.ride.update({
      where: { id: ride.id },
      data: { paymentMethod: method },
    });

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.PAYMENT_INITIATED,
      { ...context, userId: customerId },
      {
        resource: 'ride',
        resourceId: ride.id,
        metadata: { method, reference: transaction.providerReference },
      },
    );

    return {
      ride: toRideDto(updated),
      authorizationUrl: transaction.authorizationUrl ?? init.authorizationUrl,
      reference: transaction.providerReference,
    };
  }

  /**
   * Split the fare at a given commission rate. The rate is passed in (fetched
   * from the Ops-configurable PlatformCommissionSetting at settlement time)
   * rather than read from a constant, and is returned so callers can snapshot it
   * onto the ride — refunds then reverse the exact settled amounts/rate.
   *
   * DPX-PROMO-FUNDING — the split is computed on the **gross** fare, before any
   * coupon, not on what the customer paid.
   *
   * `ride.totalFare` is the discounted fare (`rides.service.ts` stores
   * `estimate.totalFare - promoDiscount`), so splitting on it made a customer
   * coupon come out of the driver's pocket: a ₦500 coupon at a 10% commission
   * cost the driver ₦450 and the platform ₦50 — the platform's marketing spend
   * billed to the driver in the commission ratio, without their knowledge or
   * agreement. A driver who never saw the coupon has no way to even notice.
   *
   * Splitting on `totalFare + promoDiscount` means the driver is paid exactly as
   * if no coupon existed, and DrippleX funds its own promotion. It also matches
   * how the market works: a real Bolt driver receipt (DPX-PRICING-001 §4A.2.2)
   * shows the rider's ₦300 promotional credit arriving as *income* to the
   * driver, paid by Bolt.
   *
   * Commission is charged on the gross too, so the platform's revenue line stays
   * "what this ride earned" and the discount stays a separate marketing cost —
   * netting them would hide both. The platform's net position on a discounted
   * ride is therefore `commission − promoDiscount`, which is **negative whenever
   * the discount exceeds the commission**. At a 10% rate that is most coupons,
   * and it is the intended behaviour: funding a promotion means paying for it.
   */
  private computeSplit(ride: Ride, rate: number): FareSplit {
    const charged = Number(ride.totalFare);
    const promoDiscount = Number(ride.promoDiscount);
    const grossFare = this.roundCurrency(charged + promoDiscount);
    const platformCommission = this.roundCurrency(grossFare * rate);
    const driverEarning = this.roundCurrency(grossFare - platformCommission);
    return {
      platformCommission,
      driverEarning,
      platformCommissionRate: rate,
      grossFare,
      promoDiscount,
    };
  }

  /**
   * The rate to use for a defensive refund recompute when a settled ride is
   * missing its stored amounts (should not happen — markPaid always writes
   * them). Prefers the ride's snapshotted rate, else the founder-locked default;
   * never re-reads the *current* Ops rate, so a later rate change cannot alter a
   * historical refund.
   */
  private rideSnapshotRate(ride: Ride): number {
    return ride.platformCommissionRate !== null
      ? Number(ride.platformCommissionRate)
      : DEFAULT_PLATFORM_COMMISSION_RATE;
  }

  /** DPX-COMMERCIAL-001 Slice 4 — bounded retry on ConflictDomainException,
   * the same pattern Slice 3 established for MerchantSettlementService's
   * accrueCommissionWithRetry(): two cash rides for the same driver
   * completing close together can race on the same CommissionAccount's
   * optimistic-concurrency version. The accrual amount never depends on
   * the current balance, so a retry is simply "try again" — safe because
   * accrue()'s own exactly-once guard (referenceType/referenceId) makes a
   * retried call idempotent even if an earlier attempt partially raced. */
  private async accrueDriverCommissionWithRetry(
    input: Parameters<CommissionAccountService['accrue']>[0],
  ): Promise<void> {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.commissionAccounts.accrue(input);
        return;
      } catch (error) {
        if (!(error instanceof ConflictDomainException) || attempt === maxAttempts) {
          throw error;
        }
      }
    }
  }

  /** DPX-D4 — a ride is refundable only once it has settled. A PAID ride can
   * be refunded; an already-REFUNDED one is rejected (the common-path duplicate
   * guard — the atomic transition in refundRide() is the concurrency-safe one);
   * anything else has no money to refund. */
  private async requireRefundableRide(rideId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    if (ride.paymentStatus === RidePaymentStatus.REFUNDED) {
      throw new ConflictDomainException('Ride has already been refunded');
    }
    if (ride.paymentStatus !== RidePaymentStatus.PAID) {
      throw new ValidationDomainException(
        `Only a settled (paid) ride can be refunded (payment status: ${ride.paymentStatus})`,
      );
    }
    return ride;
  }

  /** CASH refund — the customer's cash never entered the digital ledger, so
   * there is nothing to credit back; only the driver's accrued commission
   * liability is reversed (founder decision: do not manufacture a digital
   * customer refund for cash). Idempotent via the distinct reversal
   * referenceType; bounded retry for the shared-account version race. */
  private async refundCashRide(ride: Ride, reason: string, context: AuditContext): Promise<void> {
    const driverId = ride.driverId;
    if (driverId === null) {
      return;
    }
    // DPX-PROMO-FUNDING — a coupon on a cash ride was paid to the driver as a
    // real wallet credit at settlement, so a refund has to take it back. Done
    // before the commission reversal: the clawback can fail on an insufficient
    // driver balance, and reversing the commission first would leave the driver
    // owing nothing while still holding the platform's promotion money.
    await this.clawBackPromotionFunding(ride, driverId, reason, context);

    const commission =
      ride.platformCommission !== null
        ? Number(ride.platformCommission)
        : this.computeSplit(ride, this.rideSnapshotRate(ride)).platformCommission;
    if (commission <= 0) {
      return;
    }
    await this.withConflictRetry(() =>
      this.commissionAccounts.reverseAccrual({
        ownerType: CommissionOwnerType.DRIVER,
        ownerId: driverId,
        amount: commission,
        referenceType: COMMISSION_RIDE_REVERSAL_REFERENCE_TYPE,
        referenceId: ride.id,
        description: `Commission reversed for refunded ride ${ride.id}: ${reason}`,
        context,
      }),
    );
  }

  /** WALLET / gateway refund — the fare was captured into the platform wallet,
   * so mirror settlement's four legs. Returns the amount refunded to the
   * customer's Dx Wallet. Each leg is idempotent per (wallet, referenceType,
   * ride.id) and retried on the optimistic-version race. */
  private async refundWalletCapturedRide(
    ride: Ride,
    reason: string,
    context: AuditContext,
  ): Promise<number> {
    const totalFare = Number(ride.totalFare);
    const driverEarning =
      ride.driverEarning !== null
        ? Number(ride.driverEarning)
        : this.computeSplit(ride, this.rideSnapshotRate(ride)).driverEarning;

    // Claw the driver's earning back to the platform FIRST. At settlement the
    // platform captured the fare and paid the driver out, keeping only the
    // commission — so it must recover the driver's share before it can fund the
    // customer's full-fare refund. (In the debt path the platform fronts the
    // shortfall from its operating balance; the driver liability is the
    // offsetting receivable.)
    if (ride.driverId !== null && driverEarning > 0) {
      await this.clawBackDriverEarning(ride, ride.driverId, driverEarning, reason, context);
    }

    if (totalFare > 0) {
      // Release the captured fare from the platform wallet, then credit the
      // customer — debit-before-credit so a failure between the two briefly
      // holds money at the platform (recoverable on retry) rather than creating
      // it for the customer out of nothing.
      await this.withConflictRetry(() =>
        this.walletService.debit({
          ownerType: WalletOwnerType.PLATFORM,
          ownerId: PLATFORM_WALLET_OWNER_ID,
          amount: totalFare,
          referenceType: RIDE_WALLET_REFERENCE_TYPES.REFUND,
          referenceId: ride.id,
          description: `Ride fare refund release (${ride.id}): ${reason}`,
          context,
        }),
      );
      await this.withConflictRetry(() =>
        this.walletService.refund({
          ownerType: WalletOwnerType.CUSTOMER,
          ownerId: ride.customerId,
          amount: totalFare,
          referenceType: RIDE_WALLET_REFERENCE_TYPES.REFUND,
          referenceId: ride.id,
          description: `Ride fare refund (${ride.id}): ${reason}`,
          context,
        }),
      );
    }

    return totalFare;
  }

  /**
   * DPX-PROMO-FUNDING — recover a cash ride's promotion funding on refund.
   *
   * Mirrors `clawBackDriverEarning`'s shortfall handling: if the driver has
   * already withdrawn the money, record the shortfall as a recoverable
   * liability on their CommissionAccount rather than failing the refund or
   * letting the money vanish (the founder decision D4 settled for earnings).
   * The re-check on the insufficient path stops a concurrent refund both
   * debiting and recording a debt for the same ride.
   */
  private async clawBackPromotionFunding(
    ride: Ride,
    driverId: string,
    reason: string,
    context: AuditContext,
  ): Promise<void> {
    const promoDiscount = Number(ride.promoDiscount);
    if (promoDiscount <= 0) {
      return;
    }

    try {
      await this.withConflictRetry(() =>
        this.walletService.debit({
          ownerType: WalletOwnerType.DRIVER,
          ownerId: driverId,
          amount: promoDiscount,
          referenceType: RIDE_WALLET_REFERENCE_TYPES.PROMO_FUNDING_REVERSAL,
          referenceId: ride.id,
          description: `Promotion funding reclaimed for refunded ride ${ride.id}: ${reason}`,
          context,
        }),
      );
    } catch (error) {
      if (!(error instanceof ValidationDomainException)) {
        throw error;
      }
      const alreadyReclaimed = await this.promoFundingReversalExists(driverId, ride.id);
      if (!alreadyReclaimed) {
        await this.recordDriverLiabilityWithRetry({
          ownerType: CommissionOwnerType.DRIVER,
          ownerId: driverId,
          amount: promoDiscount,
          referenceType: COMMISSION_RIDE_EARNING_DEBT_REFERENCE_TYPE,
          referenceId: ride.id,
          description: `Unrecovered promotion funding for refunded ride ${ride.id}: ${reason}`,
          context,
        });
        return;
      }
    }

    await this.withConflictRetry(() =>
      this.walletService.credit({
        ownerType: WalletOwnerType.PLATFORM,
        ownerId: PLATFORM_WALLET_OWNER_ID,
        amount: promoDiscount,
        referenceType: RIDE_WALLET_REFERENCE_TYPES.PROMO_FUNDING_REVERSAL,
        referenceId: ride.id,
        description: `Promotion funding returned to platform (${ride.id}): ${reason}`,
        context,
      }),
    );
  }

  private async promoFundingReversalExists(driverId: string, rideId: string): Promise<boolean> {
    const entry = await this.prisma.walletLedgerEntry.findFirst({
      where: {
        wallet: { ownerType: WalletOwnerType.DRIVER, ownerId: driverId },
        referenceType: RIDE_WALLET_REFERENCE_TYPES.PROMO_FUNDING_REVERSAL,
        referenceId: rideId,
      },
    });
    return entry !== null;
  }

  /** Claw the driver's earning back to the platform. If the driver's wallet
   * can't cover it (already withdrawn), record the shortfall as a recoverable
   * driver liability instead of silently failing (founder decision: money must
   * not disappear). The re-check on the insufficient path prevents a concurrent
   * refund from both debiting AND recording a debt for the same ride. */
  private async clawBackDriverEarning(
    ride: Ride,
    driverId: string,
    driverEarning: number,
    reason: string,
    context: AuditContext,
  ): Promise<void> {
    try {
      await this.withConflictRetry(() =>
        this.walletService.debit({
          ownerType: WalletOwnerType.DRIVER,
          ownerId: driverId,
          amount: driverEarning,
          referenceType: RIDE_WALLET_REFERENCE_TYPES.EARNING_REVERSAL,
          referenceId: ride.id,
          description: `Driver earning clawback for refunded ride ${ride.id}: ${reason}`,
          context,
        }),
      );
    } catch (error) {
      if (!(error instanceof ValidationDomainException)) {
        throw error;
      }
      // Insufficient driver balance. Under a concurrent refund the winner may
      // already have debited it — only record a debt if no clawback debit
      // exists yet, so we never both debit AND record a liability.
      const alreadyClawedBack = await this.driverEarningReversalExists(driverId, ride.id);
      if (!alreadyClawedBack) {
        await this.recordDriverLiabilityWithRetry({
          ownerType: CommissionOwnerType.DRIVER,
          ownerId: driverId,
          amount: driverEarning,
          referenceType: COMMISSION_RIDE_EARNING_DEBT_REFERENCE_TYPE,
          referenceId: ride.id,
          description: `Unrecovered driver earning for refunded ride ${ride.id}: ${reason}`,
          context,
        });
        return;
      }
      // A concurrent refund already clawed it back — fall through and ensure the
      // matching platform credit leg is applied (idempotent).
    }

    // The driver's earning is back with the platform — credit it.
    await this.withConflictRetry(() =>
      this.walletService.credit({
        ownerType: WalletOwnerType.PLATFORM,
        ownerId: PLATFORM_WALLET_OWNER_ID,
        amount: driverEarning,
        referenceType: RIDE_WALLET_REFERENCE_TYPES.EARNING_REVERSAL,
        referenceId: ride.id,
        description: `Driver earning clawback returned to platform (${ride.id}): ${reason}`,
        context,
      }),
    );
  }

  private async driverEarningReversalExists(driverId: string, rideId: string): Promise<boolean> {
    const entry = await this.prisma.walletLedgerEntry.findFirst({
      where: {
        wallet: { ownerType: WalletOwnerType.DRIVER, ownerId: driverId },
        referenceType: RIDE_WALLET_REFERENCE_TYPES.EARNING_REVERSAL,
        referenceId: rideId,
      },
    });
    return entry !== null;
  }

  private async recordDriverLiabilityWithRetry(
    input: Parameters<CommissionAccountService['recordLiability']>[0],
  ): Promise<void> {
    await this.withConflictRetry(() => this.commissionAccounts.recordLiability(input));
  }

  /** Bounded retry on the optimistic-concurrency ConflictDomainException that a
   * wallet/commission mutation raises when another operation moved the same
   * balance first — the D7 pattern. Every wrapped mutation is idempotent by
   * reference, so a retried call that already applied is a safe no-op. Only
   * ConflictDomainException is retried; ValidationDomainException (e.g.
   * insufficient balance) propagates so callers can branch on it. */
  private async withConflictRetry<T>(op: () => Promise<T>): Promise<T> {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await op();
      } catch (error) {
        if (!(error instanceof ConflictDomainException) || attempt === maxAttempts) {
          throw error;
        }
      }
    }
    // Unreachable — the loop returns or throws within maxAttempts.
    throw new ConflictDomainException('Balance changed; retry operation');
  }

  /**
   * DPX-PROMO-FUNDING — pay the platform's share of a coupon to a CASH driver.
   *
   * Debit-before-credit, the same ordering `refundWalletCapturedRide` uses: a
   * failure between the two legs briefly holds money at the platform, which is
   * recoverable on retry, rather than creating it for the driver out of nothing.
   * Both legs are idempotent per (wallet, PROMO_FUNDING, ride.id), so a retried
   * or concurrent `confirmCash` funds the promotion exactly once.
   *
   * A no-op on the overwhelming majority of rides, which carry no coupon.
   */
  private async fundDriverPromotion(
    ride: Ride,
    driverId: string,
    split: FareSplit,
    context: AuditContext,
  ): Promise<void> {
    if (split.promoDiscount <= 0) {
      return;
    }

    await this.withConflictRetry(() =>
      this.walletService.debit({
        ownerType: WalletOwnerType.PLATFORM,
        ownerId: PLATFORM_WALLET_OWNER_ID,
        amount: split.promoDiscount,
        referenceType: RIDE_WALLET_REFERENCE_TYPES.PROMO_FUNDING,
        referenceId: ride.id,
        description: `Platform-funded promotion for cash ride (${ride.id})`,
        context,
      }),
    );
    await this.withConflictRetry(() =>
      this.walletService.credit({
        ownerType: WalletOwnerType.DRIVER,
        ownerId: driverId,
        amount: split.promoDiscount,
        referenceType: RIDE_WALLET_REFERENCE_TYPES.PROMO_FUNDING,
        referenceId: ride.id,
        description: `DrippleX promotion funding for ride ${ride.id}`,
        context,
      }),
    );
  }

  private async captureIntoPlatformWallet(ride: Ride, context: AuditContext): Promise<void> {
    await this.walletService.credit({
      ownerType: WalletOwnerType.PLATFORM,
      ownerId: PLATFORM_WALLET_OWNER_ID,
      amount: ride.totalFare,
      referenceType: RIDE_WALLET_REFERENCE_TYPES.FARE,
      referenceId: ride.id,
      description: `Ride fare capture (${ride.id})`,
      context,
    });
  }

  private async payoutDriver(ride: Ride, split: FareSplit, context: AuditContext): Promise<void> {
    if (!ride.driverId) {
      return;
    }

    await this.walletService.debit({
      ownerType: WalletOwnerType.PLATFORM,
      ownerId: PLATFORM_WALLET_OWNER_ID,
      amount: split.driverEarning,
      referenceType: RIDE_WALLET_REFERENCE_TYPES.EARNING,
      referenceId: ride.id,
      description: `Driver earning payout (${ride.id})`,
      context,
    });
    await this.walletService.credit({
      ownerType: WalletOwnerType.DRIVER,
      ownerId: ride.driverId,
      amount: split.driverEarning,
      referenceType: RIDE_WALLET_REFERENCE_TYPES.EARNING,
      referenceId: ride.id,
      description: `Ride earning (${ride.id})`,
      context,
    });

    const driver = await this.prisma.user.findUnique({ where: { id: ride.driverId } });
    if (driver?.email) {
      await this.notifications.notifyRideEarning({
        email: driver.email,
        rideId: ride.id,
        amount: split.driverEarning,
        currency: 'NGN',
      });
    }
  }

  private async markPaid(
    ride: Ride,
    method: RidePaymentMethod,
    split: FareSplit,
    context: AuditContext,
  ): Promise<RideDto> {
    // Atomically claim the ride's PAID transition. The conditional
    // `paymentStatus: { not: PAID }` filter is the optimistic guard: at the DB
    // row level exactly one caller can flip a not-yet-PAID ride to PAID, so two
    // concurrent settlements that both passed the earlier *unlocked*
    // paymentStatus read (RIDE-002.7's documented cash-confirm gap) can no
    // longer both settle — the loser sees `count === 0` and is rejected as
    // already paid. This only serialises the transition; the fare split and
    // commission values written are unchanged.
    const claimed = await this.prisma.ride.updateMany({
      where: { id: ride.id, paymentStatus: { not: RidePaymentStatus.PAID } },
      data: {
        paymentMethod: method,
        paymentStatus: RidePaymentStatus.PAID,
        platformCommission: split.platformCommission,
        platformCommissionRate: split.platformCommissionRate,
        driverEarning: split.driverEarning,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictDomainException('Ride has already been paid');
    }
    const updated = await this.prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.PAYMENT_SUCCEEDED,
      { ...context, userId: ride.customerId },
      {
        resource: 'ride',
        resourceId: ride.id,
        metadata: { method, totalFare: Number(ride.totalFare), ...split },
      },
    );
    await this.notifyPaymentOutcome(updated, true);
    this.events.publishToRide(ride.id, 'ride:payment', {
      rideId: ride.id,
      paymentStatus: updated.paymentStatus,
      method,
    });

    return toRideDto(updated);
  }

  private async markFailed(ride: Ride, context: AuditContext): Promise<void> {
    await this.prisma.ride.update({
      where: { id: ride.id },
      data: { paymentStatus: RidePaymentStatus.FAILED },
    });
    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.PAYMENT_FAILED,
      { ...context, userId: ride.customerId },
      { resource: 'ride', resourceId: ride.id },
    );
  }

  private async notifyPaymentOutcome(ride: Ride, success: boolean): Promise<void> {
    const customer = await this.prisma.user.findUnique({ where: { id: ride.customerId } });
    if (customer?.email) {
      await this.notifications.notifyRideLifecycle({
        audience: 'customer',
        email: customer.email,
        event: success ? 'ride_payment_succeeded' : 'ride_payment_failed',
        rideId: ride.id,
      });
    }

    await this.eventBus.emit(
      success ? DOMAIN_EVENTS.RIDE_PAYMENT_SUCCEEDED : DOMAIN_EVENTS.RIDE_PAYMENT_FAILED,
      { customerId: ride.customerId, rideId: ride.id, totalFare: String(ride.totalFare) },
    );
  }

  private getAdapter(provider: PaymentProvider): PaymentProviderAdapter {
    const adapter = this.providers.find((entry) => entry.provider === provider);
    if (!adapter) {
      throw new ValidationDomainException(`Payment provider adapter missing: ${provider}`);
    }
    return adapter;
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async requirePayableRide(customerId: string, rideId: string): Promise<Ride> {
    const ride = await this.requireOwnedRide(customerId, rideId);
    if (ride.status !== RideStatus.COMPLETED) {
      throw new ValidationDomainException(`Ride is not awaiting payment (status: ${ride.status})`);
    }
    if (ride.paymentStatus === RidePaymentStatus.PAID) {
      throw new ConflictDomainException('Ride has already been paid');
    }
    return ride;
  }

  private async requireOwnedRide(customerId: string, rideId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findFirst({ where: { id: rideId, customerId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    return ride;
  }

  private async requireCashConfirmableRide(driverId: string, rideId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findFirst({ where: { id: rideId, driverId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    if (ride.status !== RideStatus.COMPLETED) {
      throw new ValidationDomainException(`Ride is not awaiting payment (status: ${ride.status})`);
    }
    if (ride.paymentMethod !== RidePaymentMethod.CASH) {
      throw new ValidationDomainException('Ride payment method is not cash');
    }
    if (ride.paymentStatus === RidePaymentStatus.PAID) {
      throw new ConflictDomainException('Ride has already been paid');
    }
    return ride;
  }
}
