import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import {
  AssignmentMethod,
  DeliveryStatus,
  FulfillmentType,
  MessageContextType,
  OrderPaymentMethod,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';

import { AppModule } from '../app.module';

import { MessagingService } from './messaging.service';

import type { TestingModule } from '@nestjs/testing';

/**
 * DPX-CHAT-001 — a thread belongs to a job, and only to its two parties.
 *
 * The risk this pins is not "does a message save". It is that DrippleX must
 * never let one customer read another customer's conversation with their rider,
 * and must never let a rider who is not on the job join it. Authorisation is
 * read from the delivery/ride row on every request, so these run against a real
 * database rather than a mocked repository.
 */
describe('messaging (real database)', () => {
  const databaseUrl = process.env['DATABASE_URL'] ?? '';
  let prisma: PrismaClient;
  let moduleRef: TestingModule | null = null;
  let messaging: MessagingService;
  let databaseAvailable = false;

  const createdUserIds: string[] = [];
  let customerId = '';
  let riderId = '';
  let strangerId = '';
  let merchantUserId = '';
  let merchantProfileId = '';
  let deliveryJobId = '';

  const makeUser = async (name: string): Promise<string> => {
    const user = await prisma.user.create({
      data: {
        email: `${name}-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: name,
        lastName: 'Chat',
      },
    });
    createdUserIds.push(user.id);
    return user.id;
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
    messaging = moduleRef.get(MessagingService);

    customerId = await makeUser('customer');
    riderId = await makeUser('rider');
    strangerId = await makeUser('stranger');
    merchantUserId = await makeUser('merchant');
    const profile = await prisma.merchantProfile.create({ data: { userId: merchantUserId } });
    merchantProfileId = profile.id;

    const order = await prisma.order.create({
      data: {
        customerId,
        merchantId: merchantProfileId,
        orderNumber: `DPX-${randomUUID().slice(0, 12).toUpperCase()}`,
        status: OrderStatus.READY,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: OrderPaymentMethod.PAYSTACK,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 5000,
        deliveryFee: 1500,
        total: 6500,
      },
    });
    const job = await prisma.deliveryJob.create({
      data: {
        orderId: order.id,
        riderId,
        merchantId: merchantUserId,
        customerId,
        assignmentMethod: AssignmentMethod.AUTO,
        status: DeliveryStatus.ON_THE_WAY,
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        dropoffLatitude: 6.6018,
        dropoffLongitude: 3.3515,
        deliveryFee: 1500,
      },
    });
    deliveryJobId = job.id;
  }, 60_000);

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.message.deleteMany({ where: { contextId: deliveryJobId } });
      await prisma.deliveryJob.deleteMany({ where: { customerId } });
      await prisma.order.deleteMany({ where: { customerId } });
      await prisma.merchantProfile.deleteMany({ where: { id: merchantProfileId } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await moduleRef?.close();
    await prisma.$disconnect();
  });

  it('carries a message from the customer to the rider on their delivery', async () => {
    if (!databaseAvailable) return;

    const sent = await messaging.sendMessage(
      customerId,
      MessageContextType.DELIVERY,
      deliveryJobId,
      'I am at the blue gate, please call when close.',
    );

    expect(sent.recipientId).toBe(riderId);
    expect(sent.mine).toBe(true);

    const riderView = await messaging.listMessages(
      riderId,
      MessageContextType.DELIVERY,
      deliveryJobId,
    );
    expect(riderView).toHaveLength(1);
    // Same message, opposite ownership — the rider sees it as theirs to answer.
    expect(riderView[0]?.mine).toBe(false);
    expect(riderView[0]?.body).toContain('blue gate');
  });

  it('replies in the other direction, to the customer', async () => {
    if (!databaseAvailable) return;

    const reply = await messaging.sendMessage(
      riderId,
      MessageContextType.DELIVERY,
      deliveryJobId,
      'On my way, five minutes.',
    );

    expect(reply.recipientId).toBe(customerId);
  });

  it('refuses to show the thread to anyone who is not on the job', async () => {
    if (!databaseAvailable) return;

    await expect(
      messaging.listMessages(strangerId, MessageContextType.DELIVERY, deliveryJobId),
    ).rejects.toThrow(/not part of this conversation/i);
  });

  it('refuses to let an outsider write into the thread', async () => {
    if (!databaseAvailable) return;

    await expect(
      messaging.sendMessage(strangerId, MessageContextType.DELIVERY, deliveryJobId, 'let me in'),
    ).rejects.toThrow(/not part of this conversation/i);
  });

  it('drops access the moment the job is reassigned to someone else', async () => {
    if (!databaseAvailable) return;
    const newRiderId = await makeUser('replacement-rider');
    await prisma.deliveryJob.update({
      where: { id: deliveryJobId },
      data: { riderId: newRiderId },
    });

    // The rider who WAS on this delivery can no longer read it — participants
    // are resolved from the job every time, never from a stored member list.
    await expect(
      messaging.listMessages(riderId, MessageContextType.DELIVERY, deliveryJobId),
    ).rejects.toThrow(/not part of this conversation/i);

    await expect(
      messaging.listMessages(newRiderId, MessageContextType.DELIVERY, deliveryJobId),
    ).resolves.toHaveLength(2);

    await prisma.deliveryJob.update({ where: { id: deliveryJobId }, data: { riderId } });
  });

  it('marks the recipient unread until they open the thread', async () => {
    if (!databaseAvailable) return;
    const before = await messaging.countUnread(customerId);

    await messaging.sendMessage(
      riderId,
      MessageContextType.DELIVERY,
      deliveryJobId,
      'Outside now.',
    );
    expect(await messaging.countUnread(customerId)).toBe(before + 1);

    await messaging.listMessages(customerId, MessageContextType.DELIVERY, deliveryJobId);
    expect(await messaging.countUnread(customerId)).toBe(0);
  });

  it('refuses a thread on a delivery that does not exist', async () => {
    if (!databaseAvailable) return;
    await expect(
      messaging.listMessages(customerId, MessageContextType.DELIVERY, randomUUID()),
    ).rejects.toThrow(/not found/i);
  });
});
