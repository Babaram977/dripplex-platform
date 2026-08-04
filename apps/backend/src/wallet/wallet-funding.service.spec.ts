import { randomUUID } from 'node:crypto';

import { PrismaClient, WalletOwnerType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';

import { WalletFundingService } from './wallet-funding.service';
import { WalletService } from './wallet.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { AppConfigService } from '../config/app-config.service';
import type { PaymentProviderAdapter } from '../payments/providers/payment-provider.adapter';
import type { PrismaService } from '../prisma/prisma.service';
import type { PaymentProvider } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

function fakeAdapter(provider: PaymentProvider): jest.Mocked<PaymentProviderAdapter> {
  return {
    provider,
    initializePayment: jest.fn(),
    verifyPayment: jest.fn(),
    handleWebhook: jest.fn(),
  };
}

describe('WalletFundingService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: WalletFundingService;
  let paystackAdapter: jest.Mocked<PaymentProviderAdapter>;
  let customerId: string;
  const createdUserIds: string[] = [];
  const createdTransactionIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;

    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    const walletService = new WalletService(prisma, auditService, new DomainEventBus());
    const config = { paymentDefaultProvider: 'PAYSTACK' } as unknown as AppConfigService;

    paystackAdapter = fakeAdapter('PAYSTACK');
    const flutterwaveAdapter = fakeAdapter('FLUTTERWAVE');
    const opayAdapter = fakeAdapter('OPAY');

    service = new WalletFundingService(prisma, walletService, auditService, config, [
      paystackAdapter,
      flutterwaveAdapter,
      opayAdapter,
    ]);

    const customer = await prisma.user.create({
      data: {
        email: `wallet-funding-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
    createdUserIds.push(customerId);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.walletTopUpTransaction.deleteMany({
        where: { id: { in: createdTransactionIds } },
      });
      await prisma.walletLedgerEntry.deleteMany({
        where: { wallet: { ownerId: { in: createdUserIds } } },
      });
      await prisma.wallet
        .deleteMany({ where: { ownerId: { in: createdUserIds } } })
        .catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initiates a funding transaction and records the authorization URL', async () => {
    if (!databaseAvailable) return;

    paystackAdapter.initializePayment.mockResolvedValue({
      provider: 'PAYSTACK',
      reference: 'WALLET-REF-1',
      authorizationUrl: 'https://checkout.paystack.com/abc123',
      accessCode: 'access-1',
      raw: { status: true },
    });

    const result = await service.initiateFunding(customerId, { amount: 5000 }, {});

    expect(result).toEqual({
      authorizationUrl: 'https://checkout.paystack.com/abc123',
      reference: 'WALLET-REF-1',
    });
    expect(paystackAdapter.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000, currency: 'NGN' }),
    );

    const transaction = await prisma.walletTopUpTransaction.findFirst({
      where: { providerReference: 'WALLET-REF-1' },
    });
    expect(transaction).not.toBeNull();
    if (transaction) createdTransactionIds.push(transaction.id);
    expect(transaction?.status).toBe('PENDING');
    expect(Number(transaction?.amount)).toBe(5000);
  });

  it('credits the wallet once verification succeeds', async () => {
    if (!databaseAvailable) return;

    paystackAdapter.initializePayment.mockResolvedValue({
      provider: 'PAYSTACK',
      reference: 'WALLET-REF-2',
      authorizationUrl: 'https://checkout.paystack.com/xyz789',
      raw: {},
    });
    await service.initiateFunding(customerId, { amount: 2500 }, {});
    const transaction = await prisma.walletTopUpTransaction.findFirstOrThrow({
      where: { providerReference: 'WALLET-REF-2' },
    });
    createdTransactionIds.push(transaction.id);

    paystackAdapter.verifyPayment.mockResolvedValue({
      success: true,
      reference: 'WALLET-REF-2',
      providerTransactionId: 'txn-2',
      paidAt: new Date(),
      gatewayResponse: { status: 'success' },
    });

    const wallet = await service.verifyFunding(customerId, { reference: 'WALLET-REF-2' }, {});

    expect(wallet.availableBalance).toBe(2500);

    const updated = await prisma.walletTopUpTransaction.findUniqueOrThrow({
      where: { id: transaction.id },
    });
    expect(updated.status).toBe('SUCCESS');
    expect(updated.verifiedAt).not.toBeNull();

    const ledgerEntry = await prisma.walletLedgerEntry.findFirst({
      where: { referenceType: 'wallet_topup', referenceId: transaction.id },
    });
    expect(ledgerEntry).not.toBeNull();
    expect(Number(ledgerEntry?.amount)).toBe(2500);
  });

  it('marks the transaction failed when the gateway reports failure', async () => {
    if (!databaseAvailable) return;

    paystackAdapter.initializePayment.mockResolvedValue({
      provider: 'PAYSTACK',
      reference: 'WALLET-REF-3',
      authorizationUrl: 'https://checkout.paystack.com/fail',
      raw: {},
    });
    await service.initiateFunding(customerId, { amount: 1000 }, {});
    const transaction = await prisma.walletTopUpTransaction.findFirstOrThrow({
      where: { providerReference: 'WALLET-REF-3' },
    });
    createdTransactionIds.push(transaction.id);

    paystackAdapter.verifyPayment.mockResolvedValue({
      success: false,
      reference: 'WALLET-REF-3',
    });

    await expect(
      service.verifyFunding(customerId, { reference: 'WALLET-REF-3' }, {}),
    ).rejects.toThrow('Wallet funding verification failed');

    const updated = await prisma.walletTopUpTransaction.findUniqueOrThrow({
      where: { id: transaction.id },
    });
    expect(updated.status).toBe('FAILED');
  });

  it('is idempotent when verifying an already-successful transaction', async () => {
    if (!databaseAvailable) return;

    paystackAdapter.initializePayment.mockResolvedValue({
      provider: 'PAYSTACK',
      reference: 'WALLET-REF-4',
      authorizationUrl: 'https://checkout.paystack.com/again',
      raw: {},
    });
    await service.initiateFunding(customerId, { amount: 500 }, {});
    const transaction = await prisma.walletTopUpTransaction.findFirstOrThrow({
      where: { providerReference: 'WALLET-REF-4' },
    });
    createdTransactionIds.push(transaction.id);

    paystackAdapter.verifyPayment.mockResolvedValue({
      success: true,
      reference: 'WALLET-REF-4',
      paidAt: new Date(),
    });
    await service.verifyFunding(customerId, { reference: 'WALLET-REF-4' }, {});

    const wallet = await service.verifyFunding(customerId, { reference: 'WALLET-REF-4' }, {});

    expect(paystackAdapter.verifyPayment).toHaveBeenCalledTimes(1);
    expect(wallet.ownerId).toBe(customerId);
    expect(wallet.ownerType).toBe(WalletOwnerType.CUSTOMER);
  });

  it('rejects verifying a transaction that does not exist', async () => {
    if (!databaseAvailable) return;

    await expect(
      service.verifyFunding(customerId, { reference: 'DOES-NOT-EXIST' }, {}),
    ).rejects.toThrow('Wallet funding transaction not found');
  });
});
