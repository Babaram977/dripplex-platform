import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import {
  FulfillmentType,
  OrderPaymentMethod,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';

import { AppModule } from '../app.module';
import { DeliveryService } from '../delivery/delivery.service';

import { MerchantOrdersService } from './merchant-orders.service';

import type { TestingModule } from '@nestjs/testing';

/**
 * DPX-ORDER-B — a "Pay to Merchant Bank" order reaches a rider.
 *
 * The bug this pins, reproduced from production on 2026-08-16: the merchant
 * marked a MERCHANT_DIRECT order READY while it was still PENDING payment,
 * `createDeliveryJob` refused it ("Order must be paid before delivery can be
 * created"), OrderReadySubscriber logged the refusal and swallowed it, and the
 * customer sat on "Pending rider" with three riders online — because no
 * delivery job existed at all.
 *
 * Real Postgres and the real DI graph: the whole point is that an event
 * crosses a module boundary and a job lands in the database, which mocks
 * cannot demonstrate.
 */
describe('merchant-direct order dispatch (real database)', () => {
  const databaseUrl = process.env['DATABASE_URL'] ?? '';
  let prisma: PrismaClient;
  let moduleRef: TestingModule | null = null;
  let merchantOrders: MerchantOrdersService;
  let delivery: DeliveryService;
  let databaseAvailable = false;

  const createdUserIds: string[] = [];
  let customerId = '';
  let merchantUserId = '';
  let merchantProfileId = '';
  let addressId = '';

  const makeUser = async (name: string): Promise<string> => {
    const user = await prisma.user.create({
      data: {
        email: `${name}-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: name,
        lastName: 'Direct',
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  };

  /** A bank-transfer order the merchant has already marked ready. */
  const makeReadyUnpaidOrder = async (): Promise<string> => {
    const order = await prisma.order.create({
      data: {
        customerId,
        merchantId: merchantProfileId,
        orderNumber: `DPX-${randomUUID().slice(0, 12).toUpperCase()}`,
        status: OrderStatus.READY,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: OrderPaymentMethod.MERCHANT_DIRECT,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 5000,
        deliveryFee: 1500,
        total: 6500,
        deliveryAddressId: addressId,
        readyAt: new Date(),
      },
    });
    return order.id;
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
    // init() — NOT just compile(). Subscribers register their handlers in
    // onModuleInit, which compile() does not run, so without this the event
    // bus has no listeners and the dispatch under test silently never happens.
    await moduleRef.init();
    merchantOrders = moduleRef.get(MerchantOrdersService);
    delivery = moduleRef.get(DeliveryService);

    customerId = await makeUser('customer');
    merchantUserId = await makeUser('merchant');
    const profile = await prisma.merchantProfile.create({ data: { userId: merchantUserId } });
    merchantProfileId = profile.id;
    const address = await prisma.customerAddress.create({
      data: {
        customerId,
        label: 'HOME',
        recipientName: 'Test Customer',
        phone: '+2348100000000',
        addressLine1: '1 Test Close',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        latitude: 6.6018,
        longitude: 3.3515,
      },
    });
    addressId = address.id;
  }, 60_000);

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.deliveryJob.deleteMany({ where: { customerId } });
      await prisma.order.deleteMany({ where: { customerId } });
      await prisma.customerAddress.deleteMany({ where: { customerId } });
      await prisma.merchantProfile.deleteMany({ where: { id: merchantProfileId } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await moduleRef?.close();
    await prisma.$disconnect();
  });

  it('will not dispatch a bank-transfer order while the transfer is unconfirmed', async () => {
    if (!databaseAvailable) return;
    const orderId = await makeReadyUnpaidOrder();

    // This is what the merchant marking it READY triggers.
    await expect(delivery.createDeliveryJob(orderId)).rejects.toThrow(/paid/i);

    const job = await prisma.deliveryJob.findFirst({ where: { orderId } });
    // No job — so no rider could ever be offered it, however many were online.
    expect(job).toBeNull();
  });

  it('dispatches the moment the merchant confirms the transfer landed', async () => {
    if (!databaseAvailable) return;
    const orderId = await makeReadyUnpaidOrder();

    await merchantOrders.confirmPaymentReceived(merchantUserId, orderId, {});

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe(PaymentStatus.PAID);
    // Confirming payment must not move the order's lifecycle status.
    expect(order.status).toBe(OrderStatus.READY);

    // The ORDER_READY re-emit crosses into DeliveryModule; give the bus a tick.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const job = await prisma.deliveryJob.findFirst({ where: { orderId } });
    expect(job).not.toBeNull();
    expect(Number(job?.deliveryFee)).toBe(1500);
  }, 20_000);

  it('is idempotent — confirming twice leaves one delivery job', async () => {
    if (!databaseAvailable) return;
    const orderId = await makeReadyUnpaidOrder();

    await merchantOrders.confirmPaymentReceived(merchantUserId, orderId, {});
    await merchantOrders.confirmPaymentReceived(merchantUserId, orderId, {});
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(await prisma.deliveryJob.count({ where: { orderId } })).toBe(1);
  }, 20_000);

  it('refuses to confirm an order belonging to another merchant', async () => {
    if (!databaseAvailable) return;
    const orderId = await makeReadyUnpaidOrder();
    const otherMerchantUserId = await makeUser('other-merchant');
    await prisma.merchantProfile.create({ data: { userId: otherMerchantUserId } });

    await expect(
      merchantOrders.confirmPaymentReceived(otherMerchantUserId, orderId, {}),
    ).rejects.toThrow(/not found/i);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe(PaymentStatus.PENDING);

    await prisma.merchantProfile.deleteMany({ where: { userId: otherMerchantUserId } });
  }, 20_000);
});
