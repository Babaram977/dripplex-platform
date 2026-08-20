import { Inject, Injectable } from '@nestjs/common';
import { PaymentProvider, TransactionStatus, WalletOwnerType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';
import {
  PAYMENT_PROVIDER_ADAPTERS,
  type PaymentProviderAdapter,
} from '../payments/providers/payment-provider.adapter';
import { PrismaService } from '../prisma/prisma.service';

import { WALLET_AUDIT_ACTIONS, WALLET_TOPUP_REFERENCE_TYPE } from './wallet.constants';
import { WalletService, type WalletDto } from './wallet.service';

import type { FundWalletDto, VerifyWalletFundingDto } from './dto/wallet-funding.dto';

export interface FundWalletResult {
  authorizationUrl: string;
  reference: string;
}

/**
 * Card top-ups of a customer's wallet — the one gap in the otherwise
 * complete order/ride payment abstraction, since neither of those flows
 * has anywhere to attach a "just add money" transaction. Mirrors
 * RidePaymentService's initiate/verify shape (explicit verify endpoint,
 * not webhook-driven — same pattern ride payments already use) rather
 * than duplicating PaymentService's order-specific webhook wiring.
 */
@Injectable()
export class WalletFundingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
    private readonly config: AppConfigService,
    @Inject(PAYMENT_PROVIDER_ADAPTERS)
    private readonly providers: PaymentProviderAdapter[],
  ) {}

  public async initiateFunding(
    customerId: string,
    dto: FundWalletDto,
    context: AuditContext,
  ): Promise<FundWalletResult> {
    const provider = this.resolveProvider(dto.provider);
    const adapter = this.getAdapter(provider);

    const customer = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!customer?.email) {
      throw new ValidationDomainException('Customer email is required to fund wallet');
    }

    const reference = `WALLET-${customerId.slice(0, 8)}-${String(Date.now())}`;
    const init = await adapter.initializePayment({
      email: customer.email,
      amount: dto.amount,
      currency: 'NGN',
      reference,
      orderId: reference,
      orderNumber: reference,
      ...(dto.callbackUrl !== undefined ? { callbackUrl: dto.callbackUrl } : {}),
    });

    const transaction = await this.prisma.walletTopUpTransaction.create({
      data: {
        walletOwnerType: WalletOwnerType.CUSTOMER,
        walletOwnerId: customerId,
        provider,
        providerReference: init.reference,
        amount: dto.amount,
        authorizationUrl: init.authorizationUrl,
        accessCode: init.accessCode ?? null,
        providerTransactionId: init.providerTransactionId ?? null,
        gatewayResponse: init.raw ?? {},
      },
    });

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.FUNDING_INITIATED,
      { ...context, userId: customerId },
      {
        resource: 'wallet',
        resourceId: customerId,
        metadata: { provider, amount: dto.amount, reference: transaction.providerReference },
      },
    );

    return {
      authorizationUrl: transaction.authorizationUrl ?? init.authorizationUrl,
      reference: transaction.providerReference,
    };
  }

  /**
   * The gateway's side of a top-up.
   *
   * `verifyFunding` only runs when the customer comes back to the app; a
   * customer who closes the tab at the gateway's success page is charged and
   * never credited. The webhook always arrives, so it settles the same row.
   * Returns null when the reference is not a wallet top-up at all.
   */
  public async completeFundingByReference(
    reference: string,
    context: AuditContext,
  ): Promise<WalletDto | null> {
    const transaction = await this.prisma.walletTopUpTransaction.findUnique({
      where: { providerReference: reference },
    });
    if (!transaction) {
      return null;
    }
    return await this.verifyFunding(transaction.walletOwnerId, { reference }, context);
  }

  public async verifyFunding(
    customerId: string,
    dto: VerifyWalletFundingDto,
    context: AuditContext,
  ): Promise<WalletDto> {
    const transaction = dto.reference
      ? await this.prisma.walletTopUpTransaction.findFirst({
          where: { providerReference: dto.reference, walletOwnerId: customerId },
        })
      : await this.prisma.walletTopUpTransaction.findFirst({
          where: { walletOwnerId: customerId },
          orderBy: { createdAt: 'desc' },
        });
    if (!transaction) {
      throw new NotFoundDomainException('Wallet funding transaction not found');
    }
    if (transaction.status === TransactionStatus.SUCCESS) {
      return await this.walletService.getWallet(WalletOwnerType.CUSTOMER, customerId);
    }

    const adapter = this.getAdapter(transaction.provider);
    const verification = await adapter.verifyPayment({ reference: transaction.providerReference });

    if (!verification.success) {
      await this.prisma.walletTopUpTransaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.FAILED,
          gatewayResponse: verification.gatewayResponse ?? {},
        },
      });
      await this.auditService.record(
        WALLET_AUDIT_ACTIONS.FUNDING_FAILED,
        { ...context, userId: customerId },
        {
          resource: 'wallet',
          resourceId: customerId,
          metadata: { reference: transaction.providerReference },
        },
      );
      throw new ValidationDomainException('Wallet funding verification failed');
    }

    // Claim the row atomically before crediting. The status check at the top
    // of this method is not enough now that the webhook can settle the same
    // top-up concurrently with the customer's return-to-app verify — two
    // callers could both pass it and credit the wallet twice.
    const claimed = await this.prisma.walletTopUpTransaction.updateMany({
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
      return await this.walletService.getWallet(WalletOwnerType.CUSTOMER, customerId);
    }

    const wallet = await this.walletService.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: customerId,
      amount: transaction.amount,
      referenceType: WALLET_TOPUP_REFERENCE_TYPE,
      referenceId: transaction.id,
      description: `Wallet top-up via ${transaction.provider}`,
      context,
    });

    await this.auditService.record(
      WALLET_AUDIT_ACTIONS.FUNDING_SUCCEEDED,
      { ...context, userId: customerId },
      {
        resource: 'wallet',
        resourceId: customerId,
        metadata: { reference: transaction.providerReference, amount: Number(transaction.amount) },
      },
    );

    return wallet;
  }

  private resolveProvider(requested?: string): PaymentProvider {
    const value = (requested ?? this.config.paymentDefaultProvider).toUpperCase();
    if (value === PaymentProvider.PAYSTACK) {
      return PaymentProvider.PAYSTACK;
    }
    if (value === PaymentProvider.FLUTTERWAVE) {
      return PaymentProvider.FLUTTERWAVE;
    }
    // OPAY is intentionally not accepted: no real OpayProvider adapter exists yet
    // (it throws NotImplementedException), so OPay is safe-disabled from wallet
    // top-up per the founder decision (DPX-DRIVER-018). An OPAY funding request is
    // rejected here with a clean 400 rather than reaching the unimplemented adapter
    // and 501-ing in production. Restore this branch once an adapter lands.
    throw new ValidationDomainException(`Unsupported payment provider: ${value}`);
  }

  private getAdapter(provider: PaymentProvider): PaymentProviderAdapter {
    const adapter = this.providers.find((entry) => entry.provider === provider);
    if (!adapter) {
      throw new ValidationDomainException(`Payment provider adapter missing: ${provider}`);
    }
    return adapter;
  }
}
