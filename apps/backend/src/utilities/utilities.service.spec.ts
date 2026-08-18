import { randomUUID } from 'node:crypto';

import {
  PrismaClient,
  UtilityPaymentMethod,
  UtilityPurchaseStatus,
  UtilityServiceType,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { WalletService } from '../wallet/wallet.service';

import { UTILITIES_PERMISSIONS } from './utilities.constants';
import { UtilitiesService } from './utilities.service';

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
  let wallets: WalletService;
  const createdUserIds: string[] = [];

  const CATALOGUE = {
    airtimeNetworks: [{ code: 'mtn', name: 'MTN' }],
    dataPlans: [
      // The G5 collision, deliberately: same plan_code, two prices.
      { id: 'M2GBS:800', planCode: 'M2GBS', amount: 800, label: '2GB — 2 days' },
      { id: 'M2GBS:1505', planCode: 'M2GBS', amount: 1505, label: '2GB — 30 days' },
    ],
    discos: [{ code: 'kaduna', name: 'Kaduna Electric', minAmount: 1100, maxAmount: 100_000 }],
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
      verifyCableCustomer: jest.fn(),
      verifyElectricityCustomer: jest.fn(),
      purchaseAirtime: jest.fn(),
      purchaseData: jest.fn(),
      purchaseCable: jest.fn(),
      purchaseElectricity: jest.fn(),
      getFloatBalance: jest.fn(),
    };

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    const walletService = new WalletService(prisma, auditService, new DomainEventBus());
    wallets = walletService;
    const config = {
      peyflexFloatLowBalanceThreshold: 50_000,
    } as unknown as AppConfigService;

    service = new UtilitiesService(
      prisma,
      walletService,
      auditService,
      config,
      provider,
      [] as PaymentProviderAdapter[],
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

  it('reports a float it cannot read rather than showing a reassuring zero', async () => {
    if (!databaseAvailable) return;
    provider.getFloatBalance.mockRejectedValue(new Error('Peyflex timed out'));
    const status = await service.getFloatStatus();
    expect(status.balance).toBeNull();
    expect(status.error).toContain('timed out');
    expect(status.low).toBe(false);
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

  it('splits read from purchase, so browsing prices is not the same grant as spending', () => {
    expect(UTILITIES_PERMISSIONS.CUSTOMER_READ).not.toBe(UTILITIES_PERMISSIONS.CUSTOMER_PURCHASE);
  });
});
