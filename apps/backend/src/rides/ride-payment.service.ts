import { Inject, Injectable } from '@nestjs/common';
import {
  RidePaymentMethod,
  RidePaymentStatus,
  RideStatus,
  TransactionStatus,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
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
import {
  RIDE_AUDIT_ACTIONS,
  RIDE_PLATFORM_COMMISSION_RATE,
  RIDE_WALLET_REFERENCE_TYPES,
} from './ride.constants';
import { toRideDto } from './ride.mapper';

import type { InitiateRidePaymentResponse, RideDto } from '@dripplex/types';
import type { PaymentProvider, Ride } from '@prisma/client';

const GATEWAY_METHODS: RidePaymentMethod[] = [
  RidePaymentMethod.PAYSTACK,
  RidePaymentMethod.FLUTTERWAVE,
  RidePaymentMethod.OPAY,
];

const RIDE_PAYMENT_METHOD_TO_PROVIDER: Partial<Record<RidePaymentMethod, PaymentProvider>> = {
  [RidePaymentMethod.PAYSTACK]: 'PAYSTACK',
  [RidePaymentMethod.FLUTTERWAVE]: 'FLUTTERWAVE',
  [RidePaymentMethod.OPAY]: 'OPAY',
};

interface FareSplit {
  platformCommission: number;
  driverEarning: number;
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

    await this.prisma.ridePaymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.SUCCESS,
        verifiedAt: new Date(),
        paidAt: verification.paidAt ?? new Date(),
        providerTransactionId: verification.providerTransactionId ?? null,
        gatewayResponse: verification.gatewayResponse ?? {},
      },
    });

    const split = this.computeSplit(ride);
    await this.captureIntoPlatformWallet(ride, context);
    await this.payoutDriver(ride, split, context);
    return await this.markPaid(ride, ride.paymentMethod, split, context);
  }

  public async confirmCash(
    driverId: string,
    rideId: string,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requireCashConfirmableRide(driverId, rideId);
    const split = this.computeSplit(ride);

    // Cash never enters the digital ledger — the driver already holds it
    // physically. Commission is recorded for accounting/audit only; actual
    // collection from the driver is a separate, not-yet-built reconciliation
    // process (see design doc).
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
        },
      },
    );

    const paid = await this.markPaid(ride, RidePaymentMethod.CASH, split, context);
    await this.eventBus.emit(DOMAIN_EVENTS.RIDE_CASH_CONFIRMED, {
      driverId,
      rideId: ride.id,
      totalFare: String(ride.totalFare),
    });
    return paid;
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
    const split = this.computeSplit(ride);

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

  private computeSplit(ride: Ride): FareSplit {
    const total = Number(ride.totalFare);
    const platformCommission = this.roundCurrency(total * RIDE_PLATFORM_COMMISSION_RATE);
    const driverEarning = this.roundCurrency(total - platformCommission);
    return { platformCommission, driverEarning };
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
    const updated = await this.prisma.ride.update({
      where: { id: ride.id },
      data: {
        paymentMethod: method,
        paymentStatus: RidePaymentStatus.PAID,
        platformCommission: split.platformCommission,
        driverEarning: split.driverEarning,
      },
    });

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
