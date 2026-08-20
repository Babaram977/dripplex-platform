import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  UtilityPaymentMethod,
  UtilityPurchaseStatus,
  UtilityServiceType,
  WalletOwnerType,
  type Prisma,
  type UtilityPurchase,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';
import {
  PAYMENT_PROVIDER_ADAPTERS,
  type PaymentProviderAdapter,
} from '../payments/providers/payment-provider.adapter';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import { roundToKobo } from './providers/peyflex.provider';
import {
  isProviderRejection,
  UTILITY_PROVIDER,
  type UtilityCablePlan,
  type UtilityCustomerLookup,
  type UtilityDataPlan,
  type UtilityElectricityDisco,
  type UtilityNetwork,
  type UtilityProviderPort,
  type UtilityPurchaseRequest,
  type UtilityPurchaseResult,
} from './providers/utility-provider.port';
import {
  UTILITIES_AUDIT_ACTIONS,
  UTILITY_AIRTIME_MAX_AMOUNT,
  UTILITY_AIRTIME_MIN_AMOUNT,
  UTILITY_CARD_REVERSAL_SUFFIX,
  UTILITY_FLOAT_EXHAUSTED_CARD_CUSTOMER_MESSAGE,
  UTILITY_FLOAT_EXHAUSTED_CUSTOMER_MESSAGE,
  UTILITY_WALLET_REFERENCE_TYPE,
  UTILITY_WALLET_REVERSAL_REFERENCE_TYPE,
} from './utilities.constants';

import type { CreateUtilityPurchaseDto, ResolveUtilityPurchaseDto } from './dto/utilities.dto';
import type { PaginatedResult } from '@dripplex/types';

export interface UtilityCatalogueDto {
  /** False until Peyflex credentials exist. The client badges the tab from
   * this rather than discovering the outage after a customer has chosen a
   * bundle. */
  available: boolean;
  /** Whether a card gateway is configured. False hides the Card option
   * instead of offering a button that fails after a bundle is chosen. */
  cardEnabled: boolean;
  services: UtilityServiceType[];
  airtimeMinAmount: number;
  airtimeMaxAmount: number;
}

export interface UtilityPurchaseDto {
  id: string;
  serviceType: UtilityServiceType;
  customerIdentifier: string;
  providerCode: string;
  planCode: string | null;
  amountCharged: number;
  paymentMethod: UtilityPaymentMethod;
  status: UtilityPurchaseStatus;
  providerReference: string | null;
  deliveredToken: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AdminUtilityPurchaseDto extends UtilityPurchaseDto {
  customerId: string;
  /** Ops-only: what the float was actually debited, and therefore the
   * margin. Never sent to the customer. */
  providerCost: number | null;
  /**
   * Exactly what the provider replied, verbatim.
   *
   * `failureReason` is written for the customer and is deliberately vague —
   * "we could not confirm this purchase" tells an operator nothing about
   * why. The raw response was already being stored on every failure and was
   * reachable only by reading the server logs, which meant diagnosing a
   * failing integration needed infrastructure access rather than the desk
   * built for it. Ops-only, never on the customer's receipt.
   */
  providerResponse: unknown;
}

export interface InitiateUtilityPurchaseResult {
  purchase: UtilityPurchaseDto;
  /** Card path only — where to send the customer to pay. */
  authorizationUrl?: string;
}

export interface UtilityFloatStatusDto {
  configured: boolean;
  balance: number | null;
  currency: string;
  threshold: number;
  low: boolean;
  /** Set when the balance could not be read at all, which is itself
   * something Ops needs to see rather than a silent zero. */
  error?: string;
}

/**
 * The Utilities money path.
 *
 * The ordering below is not stylistic. Peyflex accepts no client idempotency
 * key and offers no transaction-status lookup for these four services
 * (DPX-UTILITIES-002 G1/G2), so a request that times out cannot be resolved
 * programmatically. Everything here follows from that:
 *
 * - The purchase row is written **before** the provider is called, so a
 *   timeout leaves a resolvable record instead of a silent gap.
 * - The wallet debit carries `referenceType + referenceId`, which is where
 *   idempotency actually lives — a duplicate tap on a weak connection cannot
 *   debit twice.
 * - A provider `UNKNOWN` is **never** reversed. Reversing a purchase that
 *   may have succeeded gives a customer free electricity; refusing to reverse
 *   one that definitely failed is a support ticket. Only the second is
 *   recoverable, so PENDING is where an unanswered purchase stops, and an
 *   operator resolves it by hand.
 */
@Injectable()
export class UtilitiesService {
  private readonly logger = new Logger(UtilitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
    private readonly config: AppConfigService,
    @Inject(UTILITY_PROVIDER)
    private readonly provider: UtilityProviderPort,
    @Inject(PAYMENT_PROVIDER_ADAPTERS)
    private readonly paymentProviders: PaymentProviderAdapter[],
  ) {}

  // ── Catalogues ────────────────────────────────────────────────────────────

  public getCatalogue(): UtilityCatalogueDto {
    return {
      available: this.provider.configured,
      cardEnabled: this.config.cardPaymentsEnabled,
      services: [
        UtilityServiceType.AIRTIME,
        UtilityServiceType.DATA,
        UtilityServiceType.ELECTRICITY,
        UtilityServiceType.CABLE_TV,
      ],
      airtimeMinAmount: UTILITY_AIRTIME_MIN_AMOUNT,
      airtimeMaxAmount: UTILITY_AIRTIME_MAX_AMOUNT,
    };
  }

  public async listAirtimeNetworks(): Promise<UtilityNetwork[]> {
    return await this.provider.listAirtimeNetworks();
  }

  public async listDataNetworks(): Promise<UtilityNetwork[]> {
    return await this.provider.listDataNetworks();
  }

  public async listDataPlans(networkCode: string): Promise<UtilityDataPlan[]> {
    return await this.provider.listDataPlans(networkCode);
  }

  public async listCableProviders(): Promise<UtilityNetwork[]> {
    return await this.provider.listCableProviders();
  }

  public async listCablePlans(providerCode: string): Promise<UtilityCablePlan[]> {
    return await this.provider.listCablePlans(providerCode);
  }

  public async listElectricityDiscos(): Promise<UtilityElectricityDisco[]> {
    return await this.provider.listElectricityDiscos();
  }

  public async verifyCableCustomer(
    providerCode: string,
    smartcardNumber: string,
  ): Promise<UtilityCustomerLookup> {
    return await this.provider.verifyCableCustomer(providerCode, smartcardNumber);
  }

  public async verifyElectricityCustomer(
    discoCode: string,
    meterNumber: string,
    meterType: 'prepaid' | 'postpaid',
  ): Promise<UtilityCustomerLookup> {
    return await this.provider.verifyElectricityCustomer(discoCode, meterNumber, meterType);
  }

  // ── Purchase ──────────────────────────────────────────────────────────────

  public async initiatePurchase(
    customerId: string,
    dto: CreateUtilityPurchaseDto,
    context: AuditContext,
    callbackUrl?: string,
  ): Promise<InitiateUtilityPurchaseResult> {
    if (!this.provider.configured) {
      throw new ValidationDomainException('Bill payments are not available yet');
    }

    const resolved = await this.resolvePurchase(dto);
    // The client asks for "card"; the server decides which gateway. Resolved
    // once, here, so the stored row records the gateway that actually ran.
    const paymentMethod = this.resolvePaymentMethod(dto.paymentMethod);

    if (paymentMethod === UtilityPaymentMethod.WALLET) {
      const purchase = await this.createPurchaseRow(
        customerId,
        dto,
        resolved,
        UtilityPurchaseStatus.PENDING,
        paymentMethod,
      );
      await this.auditService.record(UTILITIES_AUDIT_ACTIONS.PURCHASE_INITIATED, context, {
        resource: 'utility_purchase',
        resourceId: purchase.id,
        metadata: { serviceType: purchase.serviceType, paymentMethod: purchase.paymentMethod },
      });

      // Debit first, provider second. A provider call made before the money
      // is reserved can deliver value we were never paid for.
      await this.walletService.debit({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: customerId,
        amount: resolved.amount,
        description: `${describeService(purchase.serviceType)} — ${purchase.customerIdentifier}`,
        referenceType: UTILITY_WALLET_REFERENCE_TYPE,
        referenceId: purchase.id,
        context,
      });

      const completed = await this.fulfil(purchase, resolved.request, context);
      return { purchase: toPurchaseDto(completed) };
    }

    // Card. The row is created AWAITING_PAYMENT and the provider is not
    // touched until the gateway confirms — so an abandoned checkout costs
    // nothing and needs no operator attention.
    const provider = this.resolvePaymentProvider(paymentMethod);
    const adapter = this.getPaymentAdapter(provider);

    const customer = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!customer?.email) {
      throw new ValidationDomainException('An email address is required to pay by card');
    }

    const reference = `UTIL-${customerId.slice(0, 8)}-${String(Date.now())}`;
    const init = await adapter.initializePayment({
      email: customer.email,
      amount: resolved.amount,
      currency: 'NGN',
      reference,
      orderId: reference,
      orderNumber: reference,
      ...(callbackUrl !== undefined ? { callbackUrl } : {}),
    });

    const purchase = await this.createPurchaseRow(
      customerId,
      dto,
      resolved,
      UtilityPurchaseStatus.AWAITING_PAYMENT,
      paymentMethod,
      init.reference,
    );

    await this.auditService.record(UTILITIES_AUDIT_ACTIONS.PURCHASE_INITIATED, context, {
      resource: 'utility_purchase',
      resourceId: purchase.id,
      metadata: {
        serviceType: purchase.serviceType,
        paymentMethod: purchase.paymentMethod,
        reference: init.reference,
      },
    });

    return { purchase: toPurchaseDto(purchase), authorizationUrl: init.authorizationUrl };
  }

  /**
   * Second half of the card path: confirm the gateway payment, then buy.
   *
   * Safe to call repeatedly — a purchase already past AWAITING_PAYMENT is
   * returned as it stands rather than bought a second time.
   */
  public async confirmCardPurchase(
    customerId: string,
    purchaseId: string,
    context: AuditContext,
  ): Promise<UtilityPurchaseDto> {
    const purchase = await this.prisma.utilityPurchase.findFirst({
      where: { id: purchaseId, customerId },
    });
    if (!purchase) {
      throw new NotFoundDomainException('Purchase not found');
    }
    if (purchase.status !== UtilityPurchaseStatus.AWAITING_PAYMENT) {
      return toPurchaseDto(purchase);
    }
    if (!purchase.paymentReference) {
      throw new ConflictDomainException('This purchase has no card payment to confirm');
    }

    const provider = this.resolvePaymentProvider(purchase.paymentMethod);
    const adapter = this.getPaymentAdapter(provider);
    const verification = await adapter.verifyPayment({ reference: purchase.paymentReference });
    if (!verification.success) {
      throw new ValidationDomainException('That card payment has not completed');
    }

    const claimed = await this.prisma.utilityPurchase.updateMany({
      where: { id: purchase.id, status: UtilityPurchaseStatus.AWAITING_PAYMENT },
      data: { status: UtilityPurchaseStatus.PENDING },
    });
    if (claimed.count === 0) {
      // A concurrent confirm won the race and is already buying.
      const current = await this.prisma.utilityPurchase.findUniqueOrThrow({
        where: { id: purchase.id },
      });
      return toPurchaseDto(current);
    }

    const request = this.buildProviderRequest(purchase);
    const completed = await this.fulfil(
      { ...purchase, status: UtilityPurchaseStatus.PENDING },
      request,
      context,
    );
    return toPurchaseDto(completed);
  }

  /**
   * The gateway's side of the card path.
   *
   * `confirmCardPurchase` only runs when the customer comes back to the app,
   * and a customer who closes the tab at the Paystack success page never
   * does — they are charged and nothing is delivered. The webhook always
   * arrives, so it drives the same idempotent confirmation. Returns null when
   * the reference belongs to some other part of the platform.
   */
  public async completeCardPurchaseByReference(
    reference: string,
    context: AuditContext,
  ): Promise<UtilityPurchaseDto | null> {
    const purchase = await this.prisma.utilityPurchase.findUnique({
      where: { paymentReference: reference },
    });
    if (!purchase) {
      return null;
    }
    return await this.confirmCardPurchase(purchase.customerId, purchase.id, context);
  }

  /**
   * Call the provider and settle the row. The customer's money is already
   * reserved by the time this runs.
   */
  private async fulfil(
    purchase: UtilityPurchase,
    request: UtilityPurchaseRequest,
    context: AuditContext,
  ): Promise<UtilityPurchase> {
    let result: UtilityPurchaseResult;
    try {
      result = await this.callProvider(purchase.serviceType, request);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Utility purchase ${purchase.id} threw: ${detail}`);

      if (isProviderRejection(error)) {
        // Refused at the door — a bad or missing token, or a malformed
        // request. The provider never processed it, so the float did not move
        // and nothing was delivered. This is a declared failure, not an
        // ambiguous one, and the customer gets their money back.
        //
        // Treating these as UNKNOWN is what left a card customer on "Still
        // confirming" while DrippleX kept the money and the Peyflex dashboard
        // showed no transaction at all — because there had not been one.
        this.logger.error(
          `Utility purchase ${purchase.id} was REJECTED by the provider (not executed) — check PEYFLEX_API_TOKEN. Reversing.`,
        );
        result = {
          outcome: 'FAILED',
          providerMessage: 'We could not reach our provider for that purchase',
        };
      } else {
        // A timeout or a provider-side error. It may still have been
        // delivered, so nothing is reversed — see the class comment.
        result = { outcome: 'UNKNOWN', providerMessage: 'The provider did not respond' };
      }
    }

    if (result.outcome === 'SUCCESS') {
      const updated = await this.prisma.utilityPurchase.update({
        where: { id: purchase.id },
        data: {
          status: UtilityPurchaseStatus.SUCCESSFUL,
          providerReference: result.providerReference ?? null,
          providerCost: result.providerCost ?? null,
          deliveredToken: result.deliveredToken ?? null,
          providerResponse: toJson(result.raw),
          completedAt: new Date(),
        },
      });
      await this.auditService.record(UTILITIES_AUDIT_ACTIONS.PURCHASE_SUCCEEDED, context, {
        resource: 'utility_purchase',
        resourceId: purchase.id,
        metadata: {
          serviceType: purchase.serviceType,
          amountCharged: purchase.amountCharged.toString(),
          providerCost: result.providerCost ?? null,
          providerReference: result.providerReference ?? null,
        },
      });
      return updated;
    }

    if (result.outcome === 'UNKNOWN') {
      // Left PENDING deliberately. See the class comment.
      const updated = await this.prisma.utilityPurchase.update({
        where: { id: purchase.id },
        data: {
          failureReason:
            'We could not confirm this purchase. Our team is checking it and will update you.',
          providerResponse: toJson(result.raw),
        },
      });
      await this.auditService.record(UTILITIES_AUDIT_ACTIONS.PURCHASE_FAILED, context, {
        resource: 'utility_purchase',
        resourceId: purchase.id,
        metadata: { outcome: 'UNKNOWN', serviceType: purchase.serviceType },
      });
      this.logger.error(
        `Utility purchase ${purchase.id} is unresolved — the float may or may not have been spent. Needs manual reconciliation against the Peyflex dashboard.`,
      );
      return updated;
    }

    // A declared failure. The provider says nothing moved, so the
    // reservation is given back.
    // Where the money went depends on how they paid, so the sentence does too.
    // A card customer really was charged; the reversal lands in their DrippleX
    // Wallet (DPX-D4), and telling them "your money has not been taken" is
    // both false and contradicted by the receipt's own "money returned".
    const paidByCard = purchase.paymentMethod !== UtilityPaymentMethod.WALLET;
    const customerMessage = result.floatExhausted
      ? paidByCard
        ? UTILITY_FLOAT_EXHAUSTED_CARD_CUSTOMER_MESSAGE
        : UTILITY_FLOAT_EXHAUSTED_CUSTOMER_MESSAGE
      : paidByCard
        ? `${result.providerMessage ?? 'That purchase could not be completed'}. ${UTILITY_CARD_REVERSAL_SUFFIX}`
        : (result.providerMessage ?? 'That purchase could not be completed');

    if (result.floatExhausted) {
      this.logger.error(
        'Peyflex refused a purchase for insufficient float — every utility purchase on the platform is failing until the float is topped up.',
      );
    }

    await this.reverse(purchase, customerMessage, context, result);
    return await this.prisma.utilityPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
  }

  /**
   * Give the reservation back.
   *
   * A wallet purchase is credited — instant, local, cannot fail. A card
   * purchase is **also** credited to the DrippleX wallet rather than refunded
   * to the card: that is the platform's existing, founder-decided refund
   * policy for gateway payments (DPX-D4 — "gateway rides refund to the Dx
   * Wallet, never the PSP"), and no gateway refund adapter exists to do
   * otherwise. Inventing one here would be speculative.
   */
  private async reverse(
    purchase: UtilityPurchase,
    customerMessage: string,
    context: AuditContext,
    result?: UtilityPurchaseResult,
  ): Promise<void> {
    await this.walletService.refund({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: purchase.customerId,
      amount: purchase.amountCharged,
      description: `Refund — ${describeService(purchase.serviceType)} could not be completed`,
      referenceType: UTILITY_WALLET_REVERSAL_REFERENCE_TYPE,
      referenceId: purchase.id,
      context,
    });

    await this.prisma.utilityPurchase.update({
      where: { id: purchase.id },
      data: {
        status: UtilityPurchaseStatus.REVERSED,
        failureReason: customerMessage.slice(0, 500),
        ...(result?.providerReference !== undefined
          ? { providerReference: result.providerReference }
          : {}),
        ...(result?.raw !== undefined ? { providerResponse: toJson(result.raw) } : {}),
        completedAt: new Date(),
      },
    });

    await this.auditService.record(UTILITIES_AUDIT_ACTIONS.PURCHASE_REVERSED, context, {
      resource: 'utility_purchase',
      resourceId: purchase.id,
      metadata: {
        serviceType: purchase.serviceType,
        amount: purchase.amountCharged.toString(),
        paymentMethod: purchase.paymentMethod,
        floatExhausted: result?.floatExhausted ?? false,
      },
    });
  }

  // ── History ───────────────────────────────────────────────────────────────

  public async listCustomerPurchases(
    customerId: string,
    page: number,
    pageSize: number,
    serviceType?: UtilityServiceType,
  ): Promise<PaginatedResult<UtilityPurchaseDto>> {
    const where: Prisma.UtilityPurchaseWhereInput = {
      customerId,
      ...(serviceType ? { serviceType } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.utilityPurchase.count({ where }),
      this.prisma.utilityPurchase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map(toPurchaseDto),
      meta: { total, page, limit: pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  public async getCustomerPurchase(
    customerId: string,
    purchaseId: string,
  ): Promise<UtilityPurchaseDto> {
    const purchase = await this.prisma.utilityPurchase.findFirst({
      where: { id: purchaseId, customerId },
    });
    if (!purchase) {
      throw new NotFoundDomainException('Purchase not found');
    }
    return toPurchaseDto(purchase);
  }

  // ── Ops ───────────────────────────────────────────────────────────────────

  public async listAllPurchases(
    page: number,
    pageSize: number,
    filters: { serviceType?: UtilityServiceType; status?: UtilityPurchaseStatus },
  ): Promise<PaginatedResult<AdminUtilityPurchaseDto>> {
    const where: Prisma.UtilityPurchaseWhereInput = {
      ...(filters.serviceType ? { serviceType: filters.serviceType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.utilityPurchase.count({ where }),
      this.prisma.utilityPurchase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map(toAdminPurchaseDto),
      meta: { total, page, limit: pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /**
   * The float, and whether it is running out.
   *
   * This is the alarm DPX-UTILITIES-001 §1.2 requires. The float is shared by
   * every utility purchase on the platform, so it hitting zero is not one
   * unlucky customer — it is all four services failing at once, presenting as
   * a generic error. Never throws: a float that cannot be read is itself
   * something Ops must see, not a 500 on the dashboard.
   */
  public async getFloatStatus(): Promise<UtilityFloatStatusDto> {
    const threshold = this.config.peyflexFloatLowBalanceThreshold;
    if (!this.provider.configured) {
      return { configured: false, balance: null, currency: 'NGN', threshold, low: false };
    }
    try {
      const float = await this.provider.getFloatBalance();
      const low = float.balance <= threshold;
      if (low) {
        this.logger.warn(
          `Peyflex float is at ${String(float.balance)}, at or below the ${String(threshold)} alarm threshold.`,
        );
      }
      return {
        configured: true,
        balance: roundToKobo(float.balance),
        currency: float.currency,
        threshold,
        low,
      };
    } catch (error) {
      return {
        configured: true,
        balance: null,
        currency: 'NGN',
        threshold,
        low: false,
        error: error instanceof Error ? error.message : 'The float balance could not be read',
      };
    }
  }

  /**
   * An operator's verdict on a purchase that is stuck holding a customer's
   * money.
   *
   * Two shapes qualify, and only two:
   *
   * PENDING — the provider never answered, so the float may or may not have
   * been spent. This is the case the method was built for.
   *
   * AWAITING_PAYMENT **that the gateway confirms was paid** — the case that
   * stranded a ₦1,000 airtime purchase on 2026-08-19. The guard here used to
   * refuse every AWAITING_PAYMENT row on the reasonable-sounding assumption
   * that it meant "the customer walked away before paying, so there is nothing
   * to resolve". That assumption is false: a purchase can be AWAITING_PAYMENT
   * *and* fully paid, which is exactly what the webhook gap produced.
   *
   * The gateway is asked before an AWAITING_PAYMENT row can be touched,
   * because `reverse()` credits the customer's wallet — resolving an abandoned
   * checkout would mint money for a payment nobody made. An unpaid row is
   * refused with a message saying so.
   *
   * SUCCESSFUL and REVERSED have already had their money moved; letting an
   * operator flip one would double the movement.
   */
  public async resolvePendingPurchase(
    purchaseId: string,
    dto: ResolveUtilityPurchaseDto,
    context: AuditContext,
  ): Promise<AdminUtilityPurchaseDto> {
    const purchase = await this.prisma.utilityPurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) {
      throw new NotFoundDomainException('Purchase not found');
    }
    if (
      purchase.status !== UtilityPurchaseStatus.PENDING &&
      purchase.status !== UtilityPurchaseStatus.AWAITING_PAYMENT
    ) {
      throw new ConflictDomainException('Only an unresolved purchase can be resolved by hand');
    }

    if (purchase.status === UtilityPurchaseStatus.AWAITING_PAYMENT) {
      if (!purchase.paymentReference) {
        throw new ConflictDomainException(
          'This purchase has no card payment, so there is nothing to resolve',
        );
      }
      const adapter = this.getPaymentAdapter(this.resolvePaymentProvider(purchase.paymentMethod));
      const verification = await adapter.verifyPayment({ reference: purchase.paymentReference });
      if (!verification.success) {
        throw new ConflictDomainException(
          'The gateway has no completed payment for this purchase — nothing was charged, so there is nothing to return',
        );
      }
      // Claim the row before moving money, exactly as confirmCardPurchase
      // does: an operator resolving by hand must not race a webhook that has
      // just arrived for the same reference.
      const claimed = await this.prisma.utilityPurchase.updateMany({
        where: { id: purchase.id, status: UtilityPurchaseStatus.AWAITING_PAYMENT },
        data: { status: UtilityPurchaseStatus.PENDING },
      });
      if (claimed.count === 0) {
        throw new ConflictDomainException('This purchase has just been settled — reload and check');
      }
      purchase.status = UtilityPurchaseStatus.PENDING;
    }

    if (dto.outcome === 'REVERSED') {
      await this.reverse(
        purchase,
        'That purchase did not go through and your money has been returned.',
        context,
      );
    } else {
      await this.prisma.utilityPurchase.update({
        where: { id: purchase.id },
        data: {
          status: UtilityPurchaseStatus.SUCCESSFUL,
          failureReason: null,
          ...(dto.providerReference !== undefined
            ? { providerReference: dto.providerReference }
            : {}),
          ...(dto.deliveredToken !== undefined ? { deliveredToken: dto.deliveredToken } : {}),
          ...(dto.providerCost !== undefined ? { providerCost: dto.providerCost } : {}),
          completedAt: new Date(),
        },
      });
    }

    await this.auditService.record(UTILITIES_AUDIT_ACTIONS.PURCHASE_RESOLVED, context, {
      resource: 'utility_purchase',
      resourceId: purchase.id,
      metadata: { outcome: dto.outcome, note: dto.note },
    });

    const refreshed = await this.prisma.utilityPurchase.findUniqueOrThrow({
      where: { id: purchase.id },
    });
    return toAdminPurchaseDto(refreshed);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /**
   * Turn a client request into a priced, provider-ready purchase.
   *
   * The amount for a plan-priced service comes from the **catalogue**, never
   * from the client — otherwise a customer could name their own price for a
   * data bundle. Airtime and electricity are amount-priced, so their amount
   * does come from the client, bounded here.
   */
  private async resolvePurchase(dto: CreateUtilityPurchaseDto): Promise<{
    amount: number;
    planCode: string | null;
    request: UtilityPurchaseRequest;
  }> {
    switch (dto.serviceType) {
      case UtilityServiceType.AIRTIME: {
        const amount = this.requireAmount(dto.amount);
        if (amount < UTILITY_AIRTIME_MIN_AMOUNT || amount > UTILITY_AIRTIME_MAX_AMOUNT) {
          throw new ValidationDomainException(
            `Airtime must be between ₦${String(UTILITY_AIRTIME_MIN_AMOUNT)} and ₦${String(UTILITY_AIRTIME_MAX_AMOUNT)}`,
          );
        }
        this.requireCode(await this.provider.listAirtimeNetworks(), dto.provider, 'network');
        return {
          amount,
          planCode: null,
          request: {
            providerCode: dto.provider,
            customerIdentifier: dto.customerIdentifier,
            amount,
          },
        };
      }

      case UtilityServiceType.DATA: {
        const plan = this.requirePlan(await this.provider.listDataPlans(dto.provider), dto.planId);
        return {
          amount: plan.amount,
          planCode: plan.planCode,
          request: {
            providerCode: dto.provider,
            customerIdentifier: dto.customerIdentifier,
            amount: plan.amount,
            planCode: plan.planCode,
          },
        };
      }

      case UtilityServiceType.CABLE_TV: {
        const plan = this.requirePlan(await this.provider.listCablePlans(dto.provider), dto.planId);
        return {
          amount: plan.amount,
          planCode: plan.planCode,
          request: {
            providerCode: dto.provider,
            customerIdentifier: dto.customerIdentifier,
            amount: plan.amount,
            planCode: plan.planCode,
            ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone } : {}),
          },
        };
      }

      case UtilityServiceType.ELECTRICITY: {
        const amount = this.requireAmount(dto.amount);
        const discos = await this.provider.listElectricityDiscos();
        const disco = discos.find((entry) => entry.code === dto.provider);
        if (!disco) {
          throw new ValidationDomainException('That electricity provider is not available');
        }
        // Peyflex publishes real per-disco bounds. Enforced before the money
        // moves, or the customer meets a provider rejection after paying.
        if (amount < disco.minAmount || amount > disco.maxAmount) {
          throw new ValidationDomainException(
            `${disco.name} accepts between ₦${String(disco.minAmount)} and ₦${String(disco.maxAmount)}`,
          );
        }
        return {
          amount,
          planCode: null,
          request: {
            providerCode: dto.provider,
            customerIdentifier: dto.customerIdentifier,
            amount,
            meterType: dto.meterType ?? 'prepaid',
            ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone } : {}),
          },
        };
      }
    }
  }

  private requireAmount(amount: number | undefined): number {
    if (amount === undefined) {
      throw new ValidationDomainException('An amount is required for this service');
    }
    return amount;
  }

  private requireCode(catalogue: { code: string }[], code: string, label: string): void {
    if (!catalogue.some((entry) => entry.code === code)) {
      throw new ValidationDomainException(`That ${label} is not available`);
    }
  }

  private requirePlan(
    catalogue: { id: string; planCode: string; amount: number }[],
    planId: string | undefined,
  ): { planCode: string; amount: number } {
    if (!planId) {
      throw new ValidationDomainException('A plan is required for this service');
    }
    const match = catalogue.find((entry) => entry.id === planId);
    if (!match) {
      throw new ValidationDomainException('That plan is no longer available');
    }
    return { planCode: match.planCode, amount: match.amount };
  }

  private async createPurchaseRow(
    customerId: string,
    dto: CreateUtilityPurchaseDto,
    resolved: { amount: number; planCode: string | null },
    status: UtilityPurchaseStatus,
    paymentMethod: UtilityPaymentMethod,
    paymentReference?: string,
  ): Promise<UtilityPurchase> {
    return await this.prisma.utilityPurchase.create({
      data: {
        serviceType: dto.serviceType,
        customerId,
        customerIdentifier: dto.customerIdentifier,
        providerCode: dto.provider,
        planCode: resolved.planCode,
        amountCharged: resolved.amount,
        paymentMethod,
        status,
        ...(paymentReference !== undefined ? { paymentReference } : {}),
      },
    });
  }

  /** Rebuild the provider request from a stored row, for the card path's
   * second leg. The plan code and amount are the ones priced at initiation,
   * so a catalogue change between checkout and confirmation cannot move the
   * price under the customer. */
  private buildProviderRequest(purchase: UtilityPurchase): UtilityPurchaseRequest {
    return {
      providerCode: purchase.providerCode,
      customerIdentifier: purchase.customerIdentifier,
      amount: Number(purchase.amountCharged),
      ...(purchase.planCode !== null ? { planCode: purchase.planCode } : {}),
      ...(purchase.serviceType === UtilityServiceType.ELECTRICITY
        ? { meterType: 'prepaid' as const }
        : {}),
    };
  }

  private async callProvider(
    serviceType: UtilityServiceType,
    request: UtilityPurchaseRequest,
  ): Promise<UtilityPurchaseResult> {
    switch (serviceType) {
      case UtilityServiceType.AIRTIME:
        return await this.provider.purchaseAirtime(request);
      case UtilityServiceType.DATA:
        return await this.provider.purchaseData(request);
      case UtilityServiceType.CABLE_TV:
        return await this.provider.purchaseCable(request);
      case UtilityServiceType.ELECTRICITY:
        return await this.provider.purchaseElectricity(request);
    }
  }

  /**
   * Turn the client's choice into a concrete stored payment method.
   *
   * `CARD` means "whatever gateway this platform is running", which is the
   * server's business. A client that named a gateway would break the moment
   * that gateway's keys changed.
   */
  private resolvePaymentMethod(requested: UtilityPaymentMethod | 'CARD'): UtilityPaymentMethod {
    if (requested === UtilityPaymentMethod.WALLET) return requested;

    if (requested === 'CARD') {
      // "Card, you pick." Used when the client has no reason to prefer one.
      const provider = this.config.defaultCardProvider;
      if (provider === null) {
        throw new ValidationDomainException('Card payments are not available yet');
      }
      return provider === 'PAYSTACK'
        ? UtilityPaymentMethod.PAYSTACK
        : UtilityPaymentMethod.FLUTTERWAVE;
    }

    // The customer named a gateway (founder decision: both stay live and the
    // customer chooses, because one can be down while the other works). Honour
    // it — but only if it can actually take money. A gateway whose key has been
    // removed must be refused here, plainly, rather than failing deeper with a
    // message about adapters.
    if (!this.config.availableCardProviders.includes(requested)) {
      throw new ValidationDomainException(
        'That payment method is unavailable right now. Please choose another.',
      );
    }
    return requested;
  }

  private resolvePaymentProvider(method: UtilityPaymentMethod): PaymentProvider {
    if (method === UtilityPaymentMethod.PAYSTACK) return PaymentProvider.PAYSTACK;
    if (method === UtilityPaymentMethod.FLUTTERWAVE) return PaymentProvider.FLUTTERWAVE;
    throw new ValidationDomainException('That payment method cannot be used for bill payments');
  }

  private getPaymentAdapter(provider: PaymentProvider): PaymentProviderAdapter {
    const adapter = this.paymentProviders.find((entry) => entry.provider === provider);
    if (!adapter) {
      throw new ValidationDomainException(`${provider} is not available`);
    }
    return adapter;
  }
}

// ── Mapping ─────────────────────────────────────────────────────────────────

/** The provider's raw body, stored verbatim for reconciling a disputed
 * purchase against the Peyflex dashboard. Typed `unknown` at the port so no
 * Prisma type leaks into the provider contract; widened here, once. */
function toJson(raw: unknown): Prisma.InputJsonValue {
  return raw ?? {};
}

function describeService(serviceType: UtilityServiceType): string {
  switch (serviceType) {
    case UtilityServiceType.AIRTIME:
      return 'Airtime';
    case UtilityServiceType.DATA:
      return 'Data bundle';
    case UtilityServiceType.ELECTRICITY:
      return 'Electricity';
    case UtilityServiceType.CABLE_TV:
      return 'Cable TV';
  }
}

/** The customer's view. Deliberately without `providerCost` — the margin is
 * DrippleX's business, and putting it on a customer-facing receipt invites an
 * argument about the spread on every purchase. */
export function toPurchaseDto(purchase: UtilityPurchase): UtilityPurchaseDto {
  return {
    id: purchase.id,
    serviceType: purchase.serviceType,
    customerIdentifier: purchase.customerIdentifier,
    providerCode: purchase.providerCode,
    planCode: purchase.planCode,
    amountCharged: Number(purchase.amountCharged),
    paymentMethod: purchase.paymentMethod,
    status: purchase.status,
    providerReference: purchase.providerReference,
    deliveredToken: purchase.deliveredToken,
    failureReason: purchase.failureReason,
    createdAt: purchase.createdAt.toISOString(),
    completedAt: purchase.completedAt?.toISOString() ?? null,
  };
}

export function toAdminPurchaseDto(purchase: UtilityPurchase): AdminUtilityPurchaseDto {
  return {
    ...toPurchaseDto(purchase),
    customerId: purchase.customerId,
    providerCost: purchase.providerCost === null ? null : Number(purchase.providerCost),
    providerResponse: purchase.providerResponse ?? null,
  };
}
