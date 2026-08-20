import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import {
  AssignmentMethod,
  CommissionOwnerType,
  DeliveryStatus,
  FulfillmentType,
  OrderPaymentMethod,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  WalletOwnerType,
} from '@prisma/client';

import { AppModule } from '../app.module';

import { RiderSettlementService } from './rider-settlement.service';

import type { TestingModule } from '@nestjs/testing';

/**
 * DPX-RIDER-006 — the rider actually gets paid.
 *
 * Real Postgres and the real DI graph: money rules asserted against mocks
 * prove nothing about what lands in the wallet. Skips without a database,
 * matching the convention in rides.service.spec.ts; CI sets DATABASE_REQUIRED
 * so it cannot skip there.
 */
describe('rider delivery settlement (real database)', () => {
  const databaseUrl = process.env['DATABASE_URL'] ?? '';
  let prisma: PrismaClient;
  let moduleRef: TestingModule | null = null;
  let service: RiderSettlementService;
  let databaseAvailable = false;

  const createdUserIds: string[] = [];
  let customerId = '';
  let merchantUserId = '';
  let merchantProfileId = '';

  const makeUser = async (name: string): Promise<string> => {
    const user = await prisma.user.create({
      data: {
        email: `${name}-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: name,
        lastName: 'Settlement',
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  };

  /** An order + its delivery job, ready to settle. */
  const makeDelivery = async (options: {
    riderId: string;
    deliveryFee: number;
    paymentMethod: OrderPaymentMethod;
    cashCollectedAmount?: number;
  }): Promise<string> => {
    const order = await prisma.order.create({
      data: {
        customerId,
        merchantId: merchantProfileId,
        orderNumber: `DPX-${randomUUID().slice(0, 12).toUpperCase()}`,
        status: OrderStatus.DELIVERED,
        paymentStatus:
          options.paymentMethod === OrderPaymentMethod.CASH
            ? PaymentStatus.PENDING
            : PaymentStatus.PAID,
        paymentMethod: options.paymentMethod,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 5000,
        total: 5000 + options.deliveryFee,
        deliveryFee: options.deliveryFee,
      },
    });
    const job = await prisma.deliveryJob.create({
      data: {
        orderId: order.id,
        riderId: options.riderId,
        merchantId: merchantUserId,
        customerId,
        assignmentMethod: AssignmentMethod.AUTO,
        status: DeliveryStatus.DELIVERED,
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        dropoffLatitude: 6.6018,
        dropoffLongitude: 3.3515,
        deliveryFee: options.deliveryFee,
        ...(options.cashCollectedAmount !== undefined
          ? { cashCollectedAmount: options.cashCollectedAmount }
          : {}),
      },
    });
    return job.id;
  };

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    service = moduleRef.get(RiderSettlementService);

    customerId = await makeUser('customer');
    merchantUserId = await makeUser('merchant');
    const profile = await prisma.merchantProfile.create({ data: { userId: merchantUserId } });
    merchantProfileId = profile.id;
  }, 60_000);

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.merchantProfile.deleteMany({ where: { id: merchantProfileId } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await moduleRef?.close();
    await prisma.$disconnect();
  });

  it('pays a prepaid delivery into the rider wallet, fee minus 10%', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeUser('rider-prepaid');
    const jobId = await makeDelivery({
      riderId,
      deliveryFee: 1500,
      paymentMethod: OrderPaymentMethod.PAYSTACK,
    });

    await expect(service.settleDelivery(jobId)).resolves.toBe(true);

    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(Number(job.riderEarning)).toBe(1350);
    expect(Number(job.platformCommission)).toBe(150);
    // The two halves add back to exactly the fee — no stray kobo either way.
    expect(Number(job.riderEarning) + Number(job.platformCommission)).toBe(1500);
    expect(job.settledAt).not.toBeNull();

    const wallet = await prisma.wallet.findFirst({
      where: { ownerType: WalletOwnerType.RIDER, ownerId: riderId },
    });
    expect(Number(wallet?.availableBalance)).toBe(1350);
  });

  it('does not credit a wallet for a CASH delivery — the rider already holds the money', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeUser('rider-cash');
    const jobId = await makeDelivery({
      riderId,
      deliveryFee: 1500,
      paymentMethod: OrderPaymentMethod.CASH,
      cashCollectedAmount: 6500,
    });

    await expect(service.settleDelivery(jobId)).resolves.toBe(true);

    const wallet = await prisma.wallet.findFirst({
      where: { ownerType: WalletOwnerType.RIDER, ownerId: riderId },
    });
    // Crediting here would pay the rider twice: once in cash, once in wallet.
    expect(wallet === null || Number(wallet.availableBalance) === 0).toBe(true);

    // They owe everything collected beyond their own earning (6500 − 1350).
    const account = await prisma.commissionAccount.findFirst({
      where: { ownerType: CommissionOwnerType.RIDER, ownerId: riderId },
    });
    expect(Number(account?.outstandingBalance)).toBe(5150);
  });

  it('defers a CASH delivery until the rider says what they collected', async () => {
    if (!databaseAvailable) return;
    // This is the production bug. DELIVERY_COMPLETED always reaches settlement
    // first, because confirmCash() requires the job to already be DELIVERED —
    // so at that moment cashCollectedAmount is null. Settling then claimed the
    // job and accrued only the platform commission, and the confirmation that
    // followed was swallowed by the idempotency guard. On the real order that
    // meant ₦150 accrued against ₦7,412.50 collected.
    const riderId = await makeUser('rider-cash-early');
    const jobId = await makeDelivery({
      riderId,
      deliveryFee: 1500,
      paymentMethod: OrderPaymentMethod.CASH,
    });

    await expect(service.settleDelivery(jobId)).resolves.toBe(false);

    // Crucially the job is NOT claimed, so the cash-confirmed event can still
    // do the real settlement.
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.settledAt).toBeNull();

    const account = await prisma.commissionAccount.findFirst({
      where: { ownerType: CommissionOwnerType.RIDER, ownerId: riderId },
    });
    expect(account === null || Number(account.outstandingBalance) === 0).toBe(true);
  });

  it('accrues the full amount once the cash is confirmed, not just the commission', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeUser('rider-cash-late');
    const jobId = await makeDelivery({
      riderId,
      deliveryFee: 1500,
      paymentMethod: OrderPaymentMethod.CASH,
    });

    // Completion first — deferred, exactly as it happens live.
    await expect(service.settleDelivery(jobId)).resolves.toBe(false);

    // Then the rider confirms what they took, and settlement runs for real.
    await prisma.deliveryJob.update({
      where: { id: jobId },
      data: { cashCollectedAmount: 7412.5 },
    });
    await expect(service.settleDelivery(jobId)).resolves.toBe(true);

    const account = await prisma.commissionAccount.findFirst({
      where: { ownerType: CommissionOwnerType.RIDER, ownerId: riderId },
    });
    // 7412.50 collected − 1350 kept = 6062.50 owed, not the 150 commission.
    expect(Number(account?.outstandingBalance)).toBe(6062.5);
  });

  it('is idempotent — a re-fired completion event cannot pay a rider twice', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeUser('rider-idem');
    const jobId = await makeDelivery({
      riderId,
      deliveryFee: 1000,
      paymentMethod: OrderPaymentMethod.PAYSTACK,
    });

    await expect(service.settleDelivery(jobId)).resolves.toBe(true);
    await expect(service.settleDelivery(jobId)).resolves.toBe(false);
    await expect(service.settleDelivery(jobId)).resolves.toBe(false);

    const wallet = await prisma.wallet.findFirst({
      where: { ownerType: WalletOwnerType.RIDER, ownerId: riderId },
    });
    expect(Number(wallet?.availableBalance)).toBe(900);
  });

  it('pays nothing for a job with no rider — there is nobody to pay', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeUser('rider-none');
    const jobId = await makeDelivery({
      riderId,
      deliveryFee: 1500,
      paymentMethod: OrderPaymentMethod.PAYSTACK,
    });
    await prisma.deliveryJob.update({ where: { id: jobId }, data: { riderId: null } });

    await expect(service.settleDelivery(jobId)).resolves.toBe(false);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.settledAt).toBeNull();
  });
});
