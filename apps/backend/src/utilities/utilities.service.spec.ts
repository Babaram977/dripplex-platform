import { randomUUID } from 'node:crypto';

import {
  PaymentProvider,
  PrismaClient,
  UtilityPaymentMethod,
  UtilityPurchaseStatus,
  UtilityServiceType,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { ValidationDomainException } from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { type NotificationCenterService } from '../notification-center/notification-center.service';
import { WalletService } from '../wallet/wallet.service';

import { UtilityProviderRejectedError } from './providers/utility-provider.port';
import { UTILITIES_PERMISSIONS } from './utilities.constants';
import { providerReferenceFor, UtilitiesService } from './utilities.service';
import { UtilityCustomerNotifier } from './utility-customer-notifier.service';
import { UtilityPaymentSweepService } from './utility-payment-sweep.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { AppConfigService } from '../config/app-config.service';
import type { PaymentProviderAdapter } from '../payments/providers/payment-provider.adapter';
import type { PrismaService } from '../prisma/prisma.service';
import type { UtilityProviderPort, UtilityPurchaseResult } from './providers/utility-provider.port';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * The money path, against a real Postgres.
 *
 * The behaviours pinned here are the ones where getting it wrong loses
 * somebody's money:
 *
 *  - a declared provider failure gives the reservation back;
 *  - a provider that never answered does **not** — the row stops at PENDING
 *    for a human, because Peyflex offers no way to ask what happened;
 *  - a duplicate request cannot debit twice;
 *  - the amount for a plan-priced service comes from the catalogue, never
 *    from the client.
 */
describe('UtilitiesService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: UtilitiesService;
  let provider: jest.Mocked<UtilityProviderPort>;
  /** The stub gateways, held so a test can make a verification fail. */
  let gateways: { flutterwave: jest.Mocked<PaymentProviderAdapter> };
  /** UtilityPurchase.paymentReference is unique, so a stub gateway that
   * returns one constant reference makes the second card test in the file
   * collide on it. Counted rather than randomised so a failure is repeatable. */
  let gatewayReferenceSeq = 0;
  let wallets: WalletService;
  /** Every notification the service tried to send, so a test can assert the
   *  customer was actually told — the whole point of the notifier. */
  let notificationCentre: { send: jest.Mock };
  const createdUserIds: string[] = [];

  const CATALOGUE = {
    airtimeNetworks: [{ code: 'mtn', name: 'MTN' }],
    dataPlans: [
      // The G5 collision, deliberately: same plan_code, two prices.
      { id: 'M2GBS:800', planCode: 'M2GBS', amount: 800, label: '2GB — 2 days' },
      { id: 'M2GBS:1505', planCode: 'M2GBS', amount: 1505, label: '2GB — 30 days' },
    ],
    discos: [{ code: 'kaduna', name: 'Kaduna Electric', minAmount: 1100, maxAmount: 100_000 }],
    // Code and label deliberately differ — the adapter sends Peyflex the
    // label while the client selects by code.
    bettingCompanies: [{ code: 'sportybet', name: 'SportyBet' }],
    // Real values from Peyflex's live catalogue, including the unit price
    // that the quantity multiplies.
    educationPlans: [
      { id: 'waec', planCode: 'WAEC-EPIN', unitPrice: 5350, label: 'WAEC Result Checker PIN' },
    ],
  };

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    if (databaseAvailable && createdUserIds.length > 0) {
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    if (!databaseAvailable) return;

    provider = {
      configured: true,
      listAirtimeNetworks: jest.fn().mockResolvedValue(CATALOGUE.airtimeNetworks),
      listDataNetworks: jest.fn().mockResolvedValue(CATALOGUE.airtimeNetworks),
      listDataPlans: jest.fn().mockResolvedValue(CATALOGUE.dataPlans),
      listCableProviders: jest.fn().mockResolvedValue([]),
      listCablePlans: jest.fn().mockResolvedValue([]),
      listElectricityDiscos: jest.fn().mockResolvedValue(CATALOGUE.discos),
      listBettingCompanies: jest.fn().mockResolvedValue(CATALOGUE.bettingCompanies),
      listEducationPlans: jest.fn().mockResolvedValue(CATALOGUE.educationPlans),
      verifyCableCustomer: jest.fn(),
      verifyElectricityCustomer: jest.fn(),
      verifyBettingCustomer: jest
        .fn()
        .mockResolvedValue({ customerName: 'MOGOLI PHILIP', identifier: '08105867169' }),
      purchaseBetting: jest.fn(),
      purchaseEducation: jest.fn(),
      purchaseAirtime: jest.fn(),
      purchaseData: jest.fn(),
      purchaseCable: jest.fn(),
      purchaseElectricity: jest.fn(),
      getFloatBalance: jest.fn(),
      getAccountStatus: jest.fn().mockResolvedValue({ verified: true, kycStatus: 'verified' }),
    };

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    const walletService = new WalletService(prisma, auditService, new DomainEventBus());
    wallets = walletService;
    const config = {
      peyflexFloatLowBalanceThreshold: 50_000,
      cardPaymentsEnabled: true,
      defaultCardProvider: 'FLUTTERWAVE',
      availableCardProviders: ['PAYSTACK', 'FLUTTERWAVE'],
    } as unknown as AppConfigService;

    // A stub gateway so the card path can be exercised end to end. It stands
    // in for Flutterwave specifically, because the point of the test is that
    // the SERVER chose that gateway from its own config.
    const flutterwave = {
      provider: PaymentProvider.FLUTTERWAVE,
      initializePayment: jest.fn().mockImplementation(() => {
        gatewayReferenceSeq += 1;
        const reference = `FLW-TEST-REF-${String(gatewayReferenceSeq)}`;
        return Promise.resolve({
          provider: PaymentProvider.FLUTTERWAVE,
          reference,
          authorizationUrl: `https://checkout.flutterwave.test/pay/${reference}`,
        });
      }),
      // Paid, by default. The card path asks the gateway before it buys
      // anything or returns any money, so a stub that answers nothing would
      // make every card test fail for the wrong reason.
      verifyPayment: jest.fn().mockImplementation((input: { reference: string }) =>
        Promise.resolve({
          success: true,
          reference: input.reference,
          providerTransactionId: 'flw-txn-1',
          amount: 100,
          currency: 'NGN',
          paidAt: new Date(),
        }),
      ),
      handleWebhook: jest.fn(),
    } as unknown as jest.Mocked<PaymentProviderAdapter>;
    gateways = { flutterwave };

    // Both gateways registered, because the founder's decision is that both
    // stay live and the customer picks between them.
    const paystack = {
      provider: PaymentProvider.PAYSTACK,
      initializePayment: jest.fn().mockImplementation(() => {
        gatewayReferenceSeq += 1;
        const reference = `PSK-TEST-REF-${String(gatewayReferenceSeq)}`;
        return Promise.resolve({
          provider: PaymentProvider.PAYSTACK,
          reference,
          authorizationUrl: `https://checkout.paystack.test/pay/${reference}`,
        });
      }),
      verifyPayment: jest.fn().mockImplementation((input: { reference: string }) =>
        Promise.resolve({
          success: true,
          reference: input.reference,
          providerTransactionId: 'psk-txn-1',
          amount: 100,
          currency: 'NGN',
          paidAt: new Date(),
        }),
      ),
      handleWebhook: jest.fn(),
    } as unknown as PaymentProviderAdapter;

    notificationCentre = {
      send: jest.fn().mockResolvedValue({ notification: null, skipped: false }),
    };
    const notifier = new UtilityCustomerNotifier(
      notificationCentre as unknown as NotificationCenterService,
    );

    service = new UtilitiesService(
      prisma,
      walletService,
      auditService,
      config,
      provider,
      [flutterwave, paystack],
      notifier,
    );
  });

  /** A customer with a funded wallet. */
  const fundedCustomer = async (balance: number): Promise<string> => {
    const user = await prisma.user.create({
      data: {
        email: `utilities-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: 'Amina',
        lastName: 'Utilities',
      },
    });
    createdUserIds.push(user.id);
    // Funded through the real wallet service rather than an INSERT, so the
    // ledger and the balance agree the way they would in production.
    await wallets.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: user.id,
      amount: balance,
      description: 'Test funding',
      referenceType: 'test_funding',
      referenceId: user.id,
    });
    return user.id;
  };

  const balanceOf = async (customerId: string): Promise<number> => {
    const wallet = await prisma.wallet.findFirstOrThrow({
      where: { ownerType: WalletOwnerType.CUSTOMER, ownerId: customerId },
    });
    return Number(wallet.availableBalance);
  };

  const success: UtilityPurchaseResult = {
    outcome: 'SUCCESS',
    providerReference: '202603091914NdL3liJe',
    providerCost: 99,
  };

  it('debits the wallet and records both what the customer paid and what the float cost', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue(success);

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 100,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    expect(result.purchase.status).toBe(UtilityPurchaseStatus.SUCCESSFUL);
    expect(await balanceOf(customerId)).toBe(4_900);

    // Both numbers stored, or the margin is invisible and the books do not
    // reconcile (DPX-UTILITIES-001 §2).
    const row = await prisma.utilityPurchase.findUniqueOrThrow({
      where: { id: result.purchase.id },
    });
    expect(Number(row.amountCharged)).toBe(100);
    expect(Number(row.providerCost)).toBe(99);
    expect(row.providerReference).toBe('202603091914NdL3liJe');
  });

  it('gives the money back when the provider declares a failure', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue({
      outcome: 'FAILED',
      providerMessage: 'Invalid mobile number',
    });

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 100,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    expect(result.purchase.status).toBe(UtilityPurchaseStatus.REVERSED);
    expect(result.purchase.failureReason).toBe('Invalid mobile number');
    expect(await balanceOf(customerId)).toBe(5_000);
  });

  // Peyflex refuses airtime at ₦5,000 and above. We used to accept it, take the
  // money, get refused and give it back — a round trip the customer experiences
  // as a failed payment. The refusal belongs here, before the debit.
  it('refuses ₦5,000 of airtime without touching the money, and names the real limit', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(20_000);

    await expect(
      service.initiatePurchase(
        customerId,
        {
          serviceType: UtilityServiceType.AIRTIME,
          provider: 'mtn',
          customerIdentifier: '08144216361',
          amount: 5_000,
          paymentMethod: UtilityPaymentMethod.WALLET,
        },
        { userId: customerId },
      ),
    ).rejects.toThrow(/4999/);

    // Never reached the provider, and the wallet is untouched — the whole
    // point of moving the bound: no charge, so nothing to refund.
    expect(provider.purchaseAirtime).not.toHaveBeenCalled();
    expect(await balanceOf(customerId)).toBe(20_000);
  });

  it('still sells the largest airtime Peyflex accepts', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(20_000);
    provider.purchaseAirtime.mockResolvedValue(success);

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 4_999,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    expect(result.purchase.status).toBe(UtilityPurchaseStatus.SUCCESSFUL);
    expect(await balanceOf(customerId)).toBe(15_001);
  });

  // A card customer really was charged, and DPX-D4 returns it to the DrippleX
  // Wallet rather than the card. Telling them "your money has not been taken"
  // was false, and contradicted the receipt's own "money returned" header.
  it('tells a card customer where their money went when the float is empty', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue({
      outcome: 'FAILED',
      providerMessage: 'Insufficient wallet balance',
      floatExhausted: true,
    });

    const { purchase } = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08165598782',
        amount: 100,
        paymentMethod: 'CARD',
      },
      { userId: customerId },
    );
    const settled = await service.completeCardPurchaseByReference(
      (await prisma.utilityPurchase.findUniqueOrThrow({ where: { id: purchase.id } }))
        .paymentReference ?? '',
      {},
    );

    expect(settled?.status).toBe(UtilityPurchaseStatus.REVERSED);
    expect(settled?.failureReason).toContain('returned to your DrippleX Wallet');
    expect(settled?.failureReason).not.toContain('has not been taken');
    // Still never names the DrippleX float to a customer.
    expect(settled?.failureReason?.toLowerCase()).not.toContain('float');
  });

  it('never tells the customer the DrippleX float is empty', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue({
      outcome: 'FAILED',
      // Peyflex's own words. This is about OUR wallet, not theirs — passed
      // through verbatim it reads as an accusation and sends the customer to
      // top up an account that is already funded.
      providerMessage: 'Insufficient wallet balance',
      floatExhausted: true,
    });

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 100,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    expect(result.purchase.failureReason).not.toMatch(/insufficient/i);
    expect(result.purchase.failureReason).toMatch(/temporarily unavailable/i);
    expect(await balanceOf(customerId)).toBe(5_000);
  });

  it('does NOT reverse a purchase the provider never answered for', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseElectricity.mockResolvedValue({ outcome: 'UNKNOWN' });

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.ELECTRICITY,
        provider: 'kaduna',
        customerIdentifier: '12345678901',
        amount: 2_000,
        meterType: 'prepaid',
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    // The float may or may not have been spent. Handing the money back would
    // give away electricity that was actually delivered; the row waits for a
    // human instead.
    expect(result.purchase.status).toBe(UtilityPurchaseStatus.PENDING);
    expect(await balanceOf(customerId)).toBe(3_000);
  });

  it('refunds when the provider REJECTED the request, rather than parking it on pending', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    // A wrong or revoked API token: Peyflex answers 401 and never processes
    // the request. The float cannot have moved and nothing was delivered.
    provider.purchaseElectricity.mockRejectedValue(
      new UtilityProviderRejectedError('Peyflex request failed (401): Invalid token.'),
    );

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.ELECTRICITY,
        provider: 'kaduna',
        customerIdentifier: '12345678901',
        amount: 2_000,
        meterType: 'prepaid',
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    // Money back. Treating this as UNKNOWN kept a real customer's payment and
    // showed them "Still confirming" indefinitely, while the provider
    // dashboard listed no transaction at all — because there was none.
    expect(result.purchase.status).toBe(UtilityPurchaseStatus.REVERSED);
    expect(await balanceOf(customerId)).toBe(5_000);
  });

  it('still refuses to reverse a genuine timeout — a delivered purchase must not be refunded', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    // Not a rejection: the request may have been processed before the socket
    // died, so this one is genuinely ambiguous.
    provider.purchaseElectricity.mockRejectedValue(new Error('fetch failed: aborted'));

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.ELECTRICITY,
        provider: 'kaduna',
        customerIdentifier: '12345678901',
        amount: 2_000,
        meterType: 'prepaid',
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    expect(result.purchase.status).toBe(UtilityPurchaseStatus.PENDING);
    expect(await balanceOf(customerId)).toBe(3_000);
  });

  it('lets an operator resolve an unanswered purchase, either way', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseElectricity.mockResolvedValue({ outcome: 'UNKNOWN' });
    const { purchase } = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.ELECTRICITY,
        provider: 'kaduna',
        customerIdentifier: '12345678901',
        amount: 2_000,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    const resolved = await service.resolvePendingPurchase(
      purchase.id,
      {
        outcome: 'SUCCESSFUL',
        note: 'Confirmed delivered on the Peyflex dashboard',
        deliveredToken: '1234-5678-9012-3456-7890',
        providerCost: 1_980,
      },
      { userId: 'ops-1' },
    );

    expect(resolved.status).toBe(UtilityPurchaseStatus.SUCCESSFUL);
    expect(resolved.deliveredToken).toBe('1234-5678-9012-3456-7890');
    // A confirmed delivery keeps the debit.
    expect(await balanceOf(customerId)).toBe(3_000);

    // And a resolved purchase cannot be resolved a second time — that would
    // move the money twice.
    await expect(
      service.resolvePendingPurchase(
        purchase.id,
        { outcome: 'REVERSED', note: 'changed my mind' },
        { userId: 'ops-1' },
      ),
    ).rejects.toThrow();
  });

  /**
   * The gap this closes: on 2026-08-21 a customer paid ₦1,000 for an
   * electricity token, Peyflex did not answer, and the receipt read "Still
   * confirming". Peyflex had in fact delivered. When an operator later pasted
   * the token in, nothing at all was sent — the customer had to think to go
   * back and look for it, with no reason to.
   */
  it('tells the customer when an operator finally delivers a stuck purchase', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseElectricity.mockResolvedValue({ outcome: 'UNKNOWN' });
    const { purchase } = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.ELECTRICITY,
        provider: 'kaduna',
        customerIdentifier: '04184468587',
        amount: 2_000,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );
    // Nothing is claimed while it is genuinely unresolved.
    expect(notificationCentre.send).not.toHaveBeenCalled();

    await service.resolvePendingPurchase(
      purchase.id,
      {
        outcome: 'SUCCESSFUL',
        note: 'Found on the Peyflex dashboard',
        deliveredToken: '6876 9786 3337 0514 1953',
        providerReference: '2026082104518TwoojR6',
      },
      { userId: 'ops-1' },
    );

    const sent = notificationCentre.send.mock.calls.map(
      ([dto]) => dto as { channel: string; userId: string; body: string; type: string },
    );
    expect(sent.map((s) => s.channel).sort()).toEqual(['IN_APP', 'PUSH']);
    expect(sent.every((s) => s.userId === customerId)).toBe(true);
    expect(sent.every((s) => s.type === 'UTILITY_PURCHASE_DELIVERED')).toBe(true);

    // The in-app message carries the token — that is the whole point.
    const inApp = sent.find((s) => s.channel === 'IN_APP');
    expect(inApp?.body).toContain('6876 9786 3337 0514 1953');

    // The push does NOT. It renders on a locked screen, and a meter token is
    // spendable by anyone who can read it.
    const push = sent.find((s) => s.channel === 'PUSH');
    expect(push?.body).not.toContain('6876 9786 3337 0514 1953');
    expect(push?.body).toContain('Open DrippleX');
  });

  it('tells the customer when a purchase is reversed and the money comes back', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseElectricity.mockResolvedValue({
      outcome: 'FAILED',
      providerMessage: 'Meter not found',
    });
    await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.ELECTRICITY,
        provider: 'kaduna',
        customerIdentifier: '12345678901',
        amount: 2_000,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    const sent = notificationCentre.send.mock.calls.map(
      ([dto]) => dto as { channel: string; type: string; body: string },
    );
    expect(sent.length).toBe(2);
    expect(sent.every((s) => s.type === 'UTILITY_PURCHASE_REVERSED')).toBe(true);
    expect(sent[0]?.body).toContain('DrippleX Wallet');
  });

  it('returns the money when an operator finds the purchase never landed', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseElectricity.mockResolvedValue({ outcome: 'UNKNOWN' });
    const { purchase } = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.ELECTRICITY,
        provider: 'kaduna',
        customerIdentifier: '12345678901',
        amount: 2_000,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    const resolved = await service.resolvePendingPurchase(
      purchase.id,
      { outcome: 'REVERSED', note: 'No matching transaction on the Peyflex dashboard' },
      { userId: 'ops-1' },
    );
    expect(resolved.status).toBe(UtilityPurchaseStatus.REVERSED);
    expect(await balanceOf(customerId)).toBe(5_000);
  });

  it('prices a data bundle from the catalogue, not from whatever the client sent', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseData.mockResolvedValue(success);

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.DATA,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        planId: 'M2GBS:1505',
        // A client naming its own price for a ₦1,505 bundle.
        amount: 1,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    expect(result.purchase.amountCharged).toBe(1_505);
    expect(await balanceOf(customerId)).toBe(3_495);
  });

  it('distinguishes the two bundles that share a plan_code', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseData.mockResolvedValue(success);

    const cheap = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.DATA,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        planId: 'M2GBS:800',
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );
    expect(cheap.purchase.amountCharged).toBe(800);
    expect(cheap.purchase.planCode).toBe('M2GBS');
  });

  it('enforces the per-disco amount bounds before any money moves', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);

    await expect(
      service.initiatePurchase(
        customerId,
        {
          serviceType: UtilityServiceType.ELECTRICITY,
          provider: 'kaduna',
          customerIdentifier: '12345678901',
          // Kaduna's floor is ₦1,100. Letting this through means the customer
          // meets a provider rejection after paying.
          amount: 500,
          paymentMethod: UtilityPaymentMethod.WALLET,
        },
        { userId: customerId },
      ),
    ).rejects.toThrow(/1100/);

    expect(await balanceOf(customerId)).toBe(5_000);
    expect(provider.purchaseElectricity).not.toHaveBeenCalled();
  });

  it('refuses a provider code that is not in the catalogue', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    await expect(
      service.initiatePurchase(
        customerId,
        {
          serviceType: UtilityServiceType.AIRTIME,
          provider: 'not-a-network',
          customerIdentifier: '08144216361',
          amount: 100,
          paymentMethod: UtilityPaymentMethod.WALLET,
        },
        { userId: customerId },
      ),
    ).rejects.toThrow();
    expect(provider.purchaseAirtime).not.toHaveBeenCalled();
  });

  // ── Betting ───────────────────────────────────────────────────────────────

  it('verifies the betting account server-side and funds the name it got back', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseBetting.mockResolvedValue({
      outcome: 'SUCCESS',
      providerReference: 'TIVA901C2F72162E4',
      providerCost: 999,
    });

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.BETTING,
        provider: 'sportybet',
        customerIdentifier: '08105867169',
        amount: 1_000,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    expect(result.purchase.status).toBe(UtilityPurchaseStatus.SUCCESSFUL);
    expect(provider.verifyBettingCustomer).toHaveBeenCalledWith('sportybet', '08105867169');
    // The name reaching Peyflex is the VERIFIED one. Nothing the caller sent
    // can name whose account gets credited.
    expect(provider.purchaseBetting).toHaveBeenCalledWith(
      expect.objectContaining({ customerName: 'MOGOLI PHILIP' }),
    );
    expect(result.purchase.beneficiaryName).toBe('MOGOLI PHILIP');
  });

  it('sends betting a reference derived from the purchase id, so a retry is not a second top-up', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseBetting.mockResolvedValue({ outcome: 'SUCCESS' });

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.BETTING,
        provider: 'sportybet',
        customerIdentifier: '08105867169',
        amount: 500,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    // Betting is the ONLY Peyflex call that accepts our reference, and it is
    // deterministic from the row id — the one place G1 can actually be closed.
    expect(provider.purchaseBetting).toHaveBeenCalledWith(
      expect.objectContaining({ reference: providerReferenceFor(result.purchase.id) }),
    );
  });

  it('never funds a betting account it could not verify', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.verifyBettingCustomer.mockRejectedValue(
      new ValidationDomainException('That betting account could not be verified'),
    );

    await expect(
      service.initiatePurchase(
        customerId,
        {
          serviceType: UtilityServiceType.BETTING,
          provider: 'sportybet',
          customerIdentifier: 'nosuchuser',
          amount: 1_000,
          paymentMethod: UtilityPaymentMethod.WALLET,
        },
        { userId: customerId },
      ),
    ).rejects.toThrow();

    // Fails closed: no funding call, and the wallet is untouched.
    expect(provider.purchaseBetting).not.toHaveBeenCalled();
    expect(await balanceOf(customerId)).toBe(5_000);
  });

  it('accepts a bookmaker username, not just a phone number', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseBetting.mockResolvedValue({ outcome: 'SUCCESS' });

    // Bet9ja and others identify customers by username. A digits-only rule
    // would make every one of them unusable while looking like the account
    // simply did not exist.
    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.BETTING,
        provider: 'sportybet',
        customerIdentifier: 'kola_bet99',
        amount: 500,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );
    expect(result.purchase.status).toBe(UtilityPurchaseStatus.SUCCESSFUL);
  });

  it('still requires digits for a meter or a phone', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    await expect(
      service.initiatePurchase(
        customerId,
        {
          serviceType: UtilityServiceType.AIRTIME,
          provider: 'mtn',
          customerIdentifier: 'kola_bet99',
          amount: 100,
          paymentMethod: UtilityPaymentMethod.WALLET,
        },
        { userId: customerId },
      ),
    ).rejects.toThrow();
    expect(provider.purchaseAirtime).not.toHaveBeenCalled();
  });

  // ── Education ─────────────────────────────────────────────────────────────

  it('multiplies the exam PIN unit price by the quantity, from the catalogue', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(20_000);
    provider.purchaseEducation.mockResolvedValue({
      outcome: 'SUCCESS',
      deliveredToken:
        'Serial No:WRN182135587, pin: 373820665258||Serial No:WRN182135588, pin: 373827897584||Serial No:WRN182135589, pin: 373833873043',
    });

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.EDUCATION,
        provider: 'education',
        customerIdentifier: '08144216361',
        planId: 'waec',
        quantity: 3,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    // 5,350 x 3. Priced from the catalogue, never from the client.
    expect(result.purchase.amountCharged).toBe(16_050);
    expect(await balanceOf(customerId)).toBe(3_950);
    expect(result.purchase.quantity).toBe(3);
    expect(provider.purchaseEducation).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 3, planCode: 'waec' }),
    );
  });

  it('stores every PIN it sold, without truncating the last one', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(60_000);
    // Ten PINs — comfortably past the 255 characters the column used to hold.
    // A truncated PIN is a customer who paid and received nothing usable.
    const tenPins = Array.from(
      { length: 10 },
      (_, index) => `Serial No:WRN18213558${String(index)}, pin: 37382066525${String(index)}`,
    ).join('||');
    provider.purchaseEducation.mockResolvedValue({
      outcome: 'SUCCESS',
      deliveredToken: tenPins,
    });

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.EDUCATION,
        provider: 'education',
        customerIdentifier: '08144216361',
        planId: 'waec',
        quantity: 10,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    expect(tenPins.length).toBeGreaterThan(255);
    const row = await prisma.utilityPurchase.findUniqueOrThrow({
      where: { id: result.purchase.id },
    });
    expect(row.deliveredToken).toBe(tenPins);
  });

  it('refuses a quantity beyond the guard rail before charging anyone', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(200_000);
    await expect(
      service.initiatePurchase(
        customerId,
        {
          serviceType: UtilityServiceType.EDUCATION,
          provider: 'education',
          customerIdentifier: '08144216361',
          planId: 'waec',
          quantity: 25,
          paymentMethod: UtilityPaymentMethod.WALLET,
        },
        { userId: customerId },
      ),
    ).rejects.toThrow();
    expect(provider.purchaseEducation).not.toHaveBeenCalled();
    expect(await balanceOf(customerId)).toBe(200_000);
  });

  it('defaults to one PIN when no quantity is given', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(20_000);
    provider.purchaseEducation.mockResolvedValue({ outcome: 'SUCCESS' });

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.EDUCATION,
        provider: 'education',
        customerIdentifier: '08144216361',
        planId: 'waec',
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );
    expect(result.purchase.amountCharged).toBe(5_350);
  });

  it('will not spend more than the customer has', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(50);
    provider.purchaseAirtime.mockResolvedValue(success);

    await expect(
      service.initiatePurchase(
        customerId,
        {
          serviceType: UtilityServiceType.AIRTIME,
          provider: 'mtn',
          customerIdentifier: '08144216361',
          amount: 100,
          paymentMethod: UtilityPaymentMethod.WALLET,
        },
        { userId: customerId },
      ),
    ).rejects.toThrow();

    // The provider is never reached, so no float is spent on a purchase the
    // customer could not pay for.
    expect(provider.purchaseAirtime).not.toHaveBeenCalled();
    expect(await balanceOf(customerId)).toBe(50);
  });

  it('refuses everything when the provider is not configured', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    Object.defineProperty(provider, 'configured', { value: false });

    expect(service.getCatalogue().available).toBe(false);
    await expect(
      service.initiatePurchase(
        customerId,
        {
          serviceType: UtilityServiceType.AIRTIME,
          provider: 'mtn',
          customerIdentifier: '08144216361',
          amount: 100,
          paymentMethod: UtilityPaymentMethod.WALLET,
        },
        { userId: customerId },
      ),
    ).rejects.toThrow(/not available yet/);
    expect(await balanceOf(customerId)).toBe(5_000);
  });

  it('raises the float alarm on a threshold, not on zero', async () => {
    if (!databaseAvailable) return;
    provider.getFloatBalance.mockResolvedValue({ balance: 12_000, currency: 'NGN' });
    const status = await service.getFloatStatus();
    expect(status.low).toBe(true);
    expect(status.balance).toBe(12_000);

    provider.getFloatBalance.mockResolvedValue({ balance: 250_000, currency: 'NGN' });
    expect((await service.getFloatStatus()).low).toBe(false);
  });

  it('shows an unverified provider account beside the balance, not instead of it', async () => {
    if (!databaseAvailable) return;
    // A healthy float says nothing about whether purchases will go through.
    // Peyflex caps an unverified account below the ₦4,999 it advertises and
    // refuses the excess as "Invalid input", so the balance can read fine
    // while every larger top-up is charged and refunded.
    provider.getFloatBalance.mockResolvedValue({ balance: 250_000, currency: 'NGN' });
    provider.getAccountStatus.mockResolvedValue({ verified: false, kycStatus: 'unverified' });

    const status = await service.getFloatStatus();

    expect(status.accountVerified).toBe(false);
    expect(status.kycStatus).toBe('unverified');
    expect(status.balance).toBe(250_000);
    expect(status.low).toBe(false);
  });

  it('calls the account status unknown when the provider will not say', async () => {
    if (!databaseAvailable) return;
    // Neither a verdict nor an alarm. Guessing "unverified" cries wolf on a
    // healthy account; guessing "verified" hides the cap that is failing it.
    provider.getFloatBalance.mockResolvedValue({ balance: 250_000, currency: 'NGN' });
    provider.getAccountStatus.mockRejectedValue(new Error('profile unreadable'));

    const status = await service.getFloatStatus();

    expect(status.accountVerified).toBeNull();
    expect(status.kycStatus).toBeNull();
    // …and it still reports the balance it did manage to read.
    expect(status.balance).toBe(250_000);
  });

  it('reports a float it cannot read rather than showing a reassuring zero', async () => {
    if (!databaseAvailable) return;
    provider.getFloatBalance.mockRejectedValue(new Error('Peyflex timed out'));
    provider.getAccountStatus.mockResolvedValue({ verified: true, kycStatus: 'verified' });
    const status = await service.getFloatStatus();
    expect(status.balance).toBeNull();
    expect(status.error).toContain('timed out');
    expect(status.low).toBe(false);
    // The two are read independently, so losing one does not cost the other.
    expect(status.accountVerified).toBe(true);
  });

  it("keeps the customer's receipt free of DrippleX's margin", async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue(success);
    const { purchase } = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 100,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: customerId },
    );

    const receipt = await service.getCustomerPurchase(customerId, purchase.id);
    expect(receipt).not.toHaveProperty('providerCost');
    // But Ops can see it, or the spread is unauditable.
    const admin = await service.listAllPurchases(1, 20, {});
    expect(admin.items.find((item) => item.id === purchase.id)?.providerCost).toBe(99);
  });

  it("will not hand one customer another customer's receipt", async () => {
    if (!databaseAvailable) return;
    const owner = await fundedCustomer(5_000);
    const stranger = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue(success);
    const { purchase } = await service.initiatePurchase(
      owner,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 100,
        paymentMethod: UtilityPaymentMethod.WALLET,
      },
      { userId: owner },
    );
    await expect(service.getCustomerPurchase(stranger, purchase.id)).rejects.toThrow();
  });

  it('lets the server pick the card gateway, so the client never names one', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue(success);

    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 100,
        // The client asks for "card". It does not, and must not, know which
        // gateway is live — hardcoding PAYSTACK here is the bug this replaces.
        paymentMethod: 'CARD',
      },
      { userId: customerId },
    );

    // The client said "CARD"; the server resolved it to the configured
    // gateway and recorded which one actually ran.
    expect(result.purchase.paymentMethod).toBe(UtilityPaymentMethod.FLUTTERWAVE);
    expect(result.authorizationUrl).toContain('flutterwave');
    // Nothing is bought until the gateway confirms, so an abandoned checkout
    // costs nothing and needs no operator attention.
    expect(result.purchase.status).toBe(UtilityPurchaseStatus.AWAITING_PAYMENT);
    expect(provider.purchaseAirtime).not.toHaveBeenCalled();
    expect(await balanceOf(customerId)).toBe(5_000);
  });

  // The bug that took ₦1,000 for airtime and delivered nothing: the purchase
  // was only ever completed by the customer returning to the app, and the
  // webhook — which always arrives — had no way to reach the purchase at all.
  it('completes a card purchase from the gateway reference alone', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue(success);

    const initiated = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 100,
        paymentMethod: 'CARD',
      },
      { userId: customerId },
    );
    const row = await prisma.utilityPurchase.findUniqueOrThrow({
      where: { id: initiated.purchase.id },
    });
    const reference = row.paymentReference ?? '';
    expect(reference).not.toBe('');

    // No customer id, no purchase id — only what the webhook carries.
    const settled = await service.completeCardPurchaseByReference(reference, {});
    expect(settled?.status).toBe(UtilityPurchaseStatus.SUCCESSFUL);
    expect(provider.purchaseAirtime).toHaveBeenCalledTimes(1);

    // The customer's own confirm can still arrive afterwards; it must not buy
    // a second time.
    const again = await service.completeCardPurchaseByReference(reference, {});
    expect(again?.status).toBe(UtilityPurchaseStatus.SUCCESSFUL);
    expect(provider.purchaseAirtime).toHaveBeenCalledTimes(1);
  });

  // ── The payment sweep ─────────────────────────────────────────────────────
  //
  // Abdullahi's ₦1,000 airtime, generalised. Both existing triggers are
  // event-driven — the customer returning, and the webhook — and when
  // NEITHER fires the money is taken, the row sits on AWAITING_PAYMENT, and
  // Peyflex is never called. These pin the trigger that does not wait for
  // anything to arrive.

  it('delivers a purchase the customer paid for that no webhook ever confirmed', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue(success);
    const sweep = new UtilityPaymentSweepService(prisma, service);

    const initiated = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 100,
        paymentMethod: 'CARD',
      },
      { userId: customerId },
    );

    // The customer paid and then closed the tab, and the webhook never
    // landed. Nothing has called back.
    expect(initiated.purchase.status).toBe(UtilityPurchaseStatus.AWAITING_PAYMENT);
    expect(provider.purchaseAirtime).not.toHaveBeenCalled();

    // Too fresh: the customer could still be at the gateway, so the sweep
    // leaves it alone rather than racing the fast paths. Asserted on THIS
    // row rather than on the sweep's return count — the sweep is global by
    // design, so a count is a claim about every row in the database.
    await sweep.runSweep();
    expect(provider.purchaseAirtime).not.toHaveBeenCalled();

    // Aged past the grace window — the same row, an hour later.
    await prisma.utilityPurchase.update({
      where: { id: initiated.purchase.id },
      data: { createdAt: new Date(Date.now() - 60 * 60_000) },
    });

    await sweep.runSweep();

    // Delivered, not refunded. The customer paid for airtime and gets airtime.
    const row = await prisma.utilityPurchase.findUniqueOrThrow({
      where: { id: initiated.purchase.id },
    });
    expect(row.status).toBe(UtilityPurchaseStatus.SUCCESSFUL);
    expect(provider.purchaseAirtime).toHaveBeenCalledTimes(1);
  });

  it('never buys twice, however many times it sweeps', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue(success);
    const sweep = new UtilityPaymentSweepService(prisma, service);

    const initiated = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 100,
        paymentMethod: 'CARD',
      },
      { userId: customerId },
    );
    await prisma.utilityPurchase.update({
      where: { id: initiated.purchase.id },
      data: { createdAt: new Date(Date.now() - 60 * 60_000) },
    });

    await sweep.runSweep();
    await sweep.runSweep();
    await sweep.runSweep();

    // A sweep every five minutes must not become airtime every five minutes.
    expect(provider.purchaseAirtime).toHaveBeenCalledTimes(1);
  });

  it('leaves an abandoned checkout exactly as it is', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue(success);
    const sweep = new UtilityPaymentSweepService(prisma, service);

    const initiated = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 100,
        paymentMethod: 'CARD',
      },
      { userId: customerId },
    );
    await prisma.utilityPurchase.update({
      where: { id: initiated.purchase.id },
      data: { createdAt: new Date(Date.now() - 60 * 60_000) },
    });

    // This customer opened the gateway and never paid.
    gateways.flutterwave.verifyPayment.mockResolvedValue({
      success: false,
      reference: 'unpaid',
      amount: 0,
      currency: 'NGN',
    });

    await sweep.runSweep();

    // Untouched — not delivered, and not cancelled either. Whether an
    // abandoned checkout should be cleaned up is a policy decision nobody
    // has made, and the sweep is not the place to invent one.
    const row = await prisma.utilityPurchase.findUniqueOrThrow({
      where: { id: initiated.purchase.id },
    });
    expect(row.status).toBe(UtilityPurchaseStatus.AWAITING_PAYMENT);
    expect(provider.purchaseAirtime).not.toHaveBeenCalled();
  });

  it('stops sweeping a purchase old enough to be an operator decision', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue(success);
    const sweep = new UtilityPaymentSweepService(prisma, service);

    const initiated = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 100,
        paymentMethod: 'CARD',
      },
      { userId: customerId },
    );
    // Older than the sweep window. Delivering airtime somebody bought a
    // month ago should be a person's call, not a surprise.
    await prisma.utilityPurchase.update({
      where: { id: initiated.purchase.id },
      data: { createdAt: new Date(Date.now() - 30 * 24 * 60 * 60_000) },
    });

    await sweep.runSweep();

    const row = await prisma.utilityPurchase.findUniqueOrThrow({
      where: { id: initiated.purchase.id },
    });
    expect(row.status).toBe(UtilityPurchaseStatus.AWAITING_PAYMENT);
  });

  // The founder's ₦1,000 airtime: paid at the gateway, stranded in
  // AWAITING_PAYMENT by the webhook gap, and — until this — impossible to
  // return, because the resolve path refused every AWAITING_PAYMENT row on the
  // assumption that it meant the customer never paid.
  it('lets an operator refund a paid purchase that never settled', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    const { purchase } = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 1_000,
        paymentMethod: 'CARD',
      },
      { userId: customerId },
    );
    expect(purchase.status).toBe(UtilityPurchaseStatus.AWAITING_PAYMENT);

    const resolved = await service.resolvePendingPurchase(
      purchase.id,
      { outcome: 'REVERSED', note: 'Paid at the gateway, never delivered' },
      { userId: 'ops-1' },
    );

    expect(resolved.status).toBe(UtilityPurchaseStatus.REVERSED);
    // Card refunds go to the DrippleX wallet, never the PSP (DPX-D4), so the
    // ₦1,000 lands on top of the wallet balance the card purchase never touched.
    expect(await balanceOf(customerId)).toBe(6_000);
    expect(provider.purchaseAirtime).not.toHaveBeenCalled();
  });

  // The guard that stops this becoming a way to mint money: an abandoned
  // checkout is also AWAITING_PAYMENT, and refunding one would credit a wallet
  // for a payment nobody made.
  it('refuses to refund a purchase the gateway says was never paid', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    const { purchase } = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 1_000,
        paymentMethod: 'CARD',
      },
      { userId: customerId },
    );
    gateways.flutterwave.verifyPayment.mockImplementation((input: { reference: string }) =>
      Promise.resolve({
        success: false,
        reference: input.reference,
        amount: 1_000,
        currency: 'NGN',
      }),
    );

    await expect(
      service.resolvePendingPurchase(
        purchase.id,
        { outcome: 'REVERSED', note: 'Customer says they paid' },
        { userId: 'ops-1' },
      ),
    ).rejects.toThrow(/no completed payment/);

    expect(await balanceOf(customerId)).toBe(5_000);
  });

  it('ignores a gateway reference that is not a utility purchase', async () => {
    if (!databaseAvailable) return;
    // Every subscriber sees every unmatched webhook — a wallet top-up
    // reference reaching this one is normal, not an error.
    await expect(
      service.completeCardPurchaseByReference('WALLET-deadbeef-1787109606020', {}),
    ).resolves.toBeNull();
  });

  it('refuses a card purchase outright when no gateway is configured', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    Object.defineProperty(service, 'config', {
      value: { cardPaymentsEnabled: false, defaultCardProvider: null },
    });

    await expect(
      service.initiatePurchase(
        customerId,
        {
          serviceType: UtilityServiceType.AIRTIME,
          provider: 'mtn',
          customerIdentifier: '08144216361',
          amount: 100,
          paymentMethod: 'CARD',
        },
        { userId: customerId },
      ),
    ).rejects.toThrow(/Card payments are not available/);

    // Nothing was charged and no float was spent on a payment route that
    // cannot complete.
    expect(await balanceOf(customerId)).toBe(5_000);
    expect(provider.purchaseAirtime).not.toHaveBeenCalled();
  });

  it('honours the gateway the customer picked, not just the default', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    provider.purchaseAirtime.mockResolvedValue(success);

    // The default is FLUTTERWAVE, but the customer chose PAYSTACK — because one
    // gateway can be down while the other works. The choice must survive.
    const result = await service.initiatePurchase(
      customerId,
      {
        serviceType: UtilityServiceType.AIRTIME,
        provider: 'mtn',
        customerIdentifier: '08144216361',
        amount: 100,
        paymentMethod: UtilityPaymentMethod.PAYSTACK,
      },
      { userId: customerId },
    );
    expect(result.purchase.paymentMethod).toBe(UtilityPaymentMethod.PAYSTACK);
    expect(result.authorizationUrl).toContain('paystack');
  });

  it('refuses a gateway the customer picked that cannot actually charge', async () => {
    if (!databaseAvailable) return;
    const customerId = await fundedCustomer(5_000);
    Object.defineProperty(service, 'config', {
      value: {
        cardPaymentsEnabled: true,
        defaultCardProvider: 'FLUTTERWAVE',
        availableCardProviders: ['FLUTTERWAVE'],
      },
    });

    await expect(
      service.initiatePurchase(
        customerId,
        {
          serviceType: UtilityServiceType.AIRTIME,
          provider: 'mtn',
          customerIdentifier: '08144216361',
          amount: 100,
          paymentMethod: UtilityPaymentMethod.PAYSTACK,
        },
        { userId: customerId },
      ),
    ).rejects.toThrow(/unavailable right now/);
    expect(await balanceOf(customerId)).toBe(5_000);
  });

  it('tells the client whether card is on, so it can hide the option', () => {
    // Guarded like every sibling — `service` is only built inside the
    // database-gated beforeEach.
    if (!databaseAvailable) return;
    expect(service.getCatalogue().cardEnabled).toBe(true);
  });

  it('splits read from purchase, so browsing prices is not the same grant as spending', () => {
    expect(UTILITIES_PERMISSIONS.CUSTOMER_READ).not.toBe(UTILITIES_PERMISSIONS.CUSTOMER_PURCHASE);
  });
});
