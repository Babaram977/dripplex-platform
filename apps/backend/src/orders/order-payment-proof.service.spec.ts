import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { OrderPaymentProofService } from './order-payment-proof.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageAssetService } from '../uploads/storage-asset.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-ORDER-PROOF-001. The behaviours worth pinning are the ones a dispute
 * depends on: only the customer's own MERCHANT_DIRECT order accepts a receipt,
 * the merchant who owns the order can read it and another merchant cannot, and
 * the record is append-only so two submissions both survive in order.
 */
describe('OrderPaymentProofService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OrderPaymentProofService;
  let customerId: string;
  let otherCustomerId: string;
  let merchantId: string;
  let otherMerchantId: string;
  let directOrderId: string;
  let cashOrderId: string;
  const context = {};

  // Storage is unconfigured in tests, which is exactly the dev behaviour the
  // real service documents: ownership checks pass through and URLs are returned
  // unchanged. The ownership rule itself is covered by storage-asset.service.spec.
  const storageAssets = {
    assertOwned: jest.fn(),
    toSignedGetUrl: jest.fn(async (url: string) => await Promise.resolve(url)),
  } as unknown as StorageAssetService;

  const createOrder = async (
    paymentMethod: 'MERCHANT_DIRECT' | 'CASH',
    owner: string,
    merchant: string,
  ): Promise<string> => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `PRF-${randomUUID().slice(0, 8)}`.toUpperCase(),
        customerId: owner,
        merchantId: merchant,
        subtotal: 1000,
        total: 1000,
        paymentMethod,
        fulfillmentType: 'DELIVERY',
      },
    });
    return order.id;
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
      return;
    }

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    service = new OrderPaymentProofService(
      prisma,
      new AuditService(auditLogRepository),
      storageAssets,
    );

    const makeUser = async (label: string): Promise<string> => {
      const user = await prisma.user.create({
        data: {
          email: `proof-${label}-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Proof',
          lastName: label,
        },
      });
      return user.id;
    };

    customerId = await makeUser('customer');
    otherCustomerId = await makeUser('other-customer');
    merchantId = await makeUser('merchant');
    otherMerchantId = await makeUser('other-merchant');

    directOrderId = await createOrder('MERCHANT_DIRECT', customerId, merchantId);
    cashOrderId = await createOrder('CASH', customerId, merchantId);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.order
        .deleteMany({ where: { id: { in: [directOrderId, cashOrderId] } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({
          where: { id: { in: [customerId, otherCustomerId, merchantId, otherMerchantId] } },
        })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('records a receipt against the customer’s own bank-transfer order', async () => {
    if (!databaseAvailable) return;

    const proof = await service.submit(
      customerId,
      directOrderId,
      {
        receiptUrl: 'https://storage.test/payment-proofs/x/a.png',
        reference: 'FT2401',
        amount: 1000,
      },
      context,
    );

    expect(proof.orderId).toBe(directOrderId);
    expect(proof.submittedBy).toBe(customerId);
    expect(proof.reference).toBe('FT2401');
    expect(proof.amount).toBe(1000);
  });

  it('does not mark the order paid — that stays the merchant’s confirmation', async () => {
    if (!databaseAvailable) return;

    const order = await prisma.order.findUniqueOrThrow({ where: { id: directOrderId } });
    expect(order.paymentStatus).toBe('PENDING');
  });

  it('refuses a receipt on an order that is not paid by transfer to the merchant', async () => {
    if (!databaseAvailable) return;

    await expect(
      service.submit(
        customerId,
        cashOrderId,
        { receiptUrl: 'https://storage.test/payment-proofs/x/a.png' },
        context,
      ),
    ).rejects.toThrow('paid by transfer to the merchant');
  });

  it('hides another customer’s order rather than admitting it exists', async () => {
    if (!databaseAvailable) return;

    await expect(
      service.submit(
        otherCustomerId,
        directOrderId,
        { receiptUrl: 'https://storage.test/payment-proofs/y/a.png' },
        context,
      ),
    ).rejects.toThrow('Order not found');
    await expect(service.listForCustomer(otherCustomerId, directOrderId)).rejects.toThrow(
      'Order not found',
    );
  });

  it('shows the receipts to the owning merchant and refuses another merchant', async () => {
    if (!databaseAvailable) return;

    const mine = await service.listForMerchant(merchantId, directOrderId);
    expect(mine.length).toBeGreaterThan(0);

    await expect(service.listForMerchant(otherMerchantId, directOrderId)).rejects.toThrow(
      'another merchant',
    );
  });

  it('is append-only: a second receipt is added, and both stay in order', async () => {
    if (!databaseAvailable) return;

    const before = await service.listForCustomer(customerId, directOrderId);
    await service.submit(
      customerId,
      directOrderId,
      { receiptUrl: 'https://storage.test/payment-proofs/x/b.png', note: 'clearer photo' },
      context,
    );
    const after = await service.listForCustomer(customerId, directOrderId);

    expect(after).toHaveLength(before.length + 1);
    // Oldest first — the sequence is what a dispute reads.
    expect(after[0]?.id).toBe(before[0]?.id);
    expect(after[after.length - 1]?.note).toBe('clearer photo');
  });
});
