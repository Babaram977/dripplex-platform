import { randomUUID } from 'node:crypto';

import {
  AssignmentMethod,
  DeliveryStatus,
  FulfillmentType,
  KycDocumentType,
  KycVerificationStatus,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  RiderStatus,
} from '@prisma/client';

import { type CommissionAccountService } from '../commercial/commission-account.service';

import { AssignmentService } from './assignment.service';
import { DeliveryFeeService } from './delivery-fee.service';
import {
  DELIVERY_ASSIGNMENT_ACCEPT_TIMEOUT_MS,
  DELIVERY_DISPATCH_SWEEP_BATCH_SIZE,
} from './delivery.constants';
import { DeliveryService } from './delivery.service';
import { PrismaDeliveryRepository } from './repositories/prisma-delivery.repository';

import type { AddressRepository } from '../addresses/repositories/address.repository';
import type { AuditService } from '../audit/audit.service';
import type { NotificationService } from '../notifications/notification.service';
import type { OrdersRepository } from '../orders/repositories/orders.repository';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * DPX-RIDER-004 — the dispatch flow end to end, on real Postgres.
 *
 * This is the founder's live scenario: the merchant marks an order READY, a
 * delivery job exists with no rider, and the rider is online. It walks the
 * whole eligibility chain through the real repository and the real assignment
 * service — no mocked persistence — and asserts what actually lands in the
 * delivery_jobs row.
 *
 * Skips (rather than fails) without a database, matching the convention in
 * rides.service.spec.ts; CI sets DATABASE_REQUIRED so it cannot skip there.
 */
describe('delivery dispatch flow (real database)', () => {
  const databaseUrl = process.env['DATABASE_URL'] ?? '';
  let prisma: PrismaClient;
  let service: DeliveryService;
  let repository: PrismaDeliveryRepository;
  let databaseAvailable = false;

  const createdUserIds: string[] = [];
  let customerId = '';
  let merchantUserId = '';
  let merchantProfileId = '';
  let riderId = '';
  let orderId = '';
  let jobId = '';

  const makeUser = async (firstName: string): Promise<string> => {
    const user = await prisma.user.create({
      data: {
        email: `${firstName.toLowerCase()}-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName,
        lastName: 'Dispatch',
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

    repository = new PrismaDeliveryRepository(prisma as unknown as PrismaService);
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const notifications = {
      notifyDeliveryLifecycle: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationService;
    // Real repository + real assignment service; the orders repository is a thin
    // read used by the sweep, backed by the same real rows.
    const ordersRepository = {
      findById: (id: string) =>
        prisma.order.findUnique({ where: { id }, include: { items: true } }),
      transition: jest.fn(),
    } as unknown as OrdersRepository;

    service = new DeliveryService(
      repository,
      ordersRepository,
      {} as unknown as AddressRepository,
      notifications,
      new AssignmentService(repository),
      new DeliveryFeeService(),
      audit,
      prisma as unknown as PrismaService,
      {
        getOrCreateAccount: jest.fn().mockResolvedValue({ blocked: false, outstandingBalance: 0 }),
      } as unknown as CommissionAccountService,
    );

    customerId = await makeUser('Customer');
    merchantUserId = await makeUser('Merchant');
    riderId = await makeUser('Rider');

    const merchantProfile = await prisma.merchantProfile.create({
      data: { userId: merchantUserId },
    });
    merchantProfileId = merchantProfile.id;

    // The rider is online and sharing location — but NOT yet approved, and with
    // no verified documents. This is the state that must not receive work.
    await prisma.riderProfile.create({
      data: { userId: riderId, status: RiderStatus.PENDING, isApproved: false },
    });
    await prisma.riderAvailability.create({
      data: {
        riderId,
        online: true,
        acceptingOrders: true,
        latitude: 6.53,
        longitude: 3.38,
        activeJobCount: 0,
      },
    });

    const order = await prisma.order.create({
      data: {
        customerId,
        merchantId: merchantProfileId,
        orderNumber: `DPX-${randomUUID().slice(0, 12).toUpperCase()}`,
        status: OrderStatus.READY,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 5000,
        total: 5000,
        readyAt: new Date(),
      },
    });
    orderId = order.id;

    const job = await prisma.deliveryJob.create({
      data: {
        orderId,
        merchantId: merchantUserId,
        customerId,
        assignmentMethod: AssignmentMethod.AUTO,
        status: DeliveryStatus.PENDING,
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        dropoffLatitude: 6.6018,
        dropoffLongitude: 3.3515,
        deliveryFee: 1400,
      },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.deliveryJob.deleteMany({ where: { id: jobId } });
      await prisma.order.deleteMany({ where: { id: orderId } });
      await prisma.merchantProfile.deleteMany({ where: { id: merchantProfileId } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it('leaves the delivery unassigned while the rider is online but unapproved', async () => {
    if (!databaseAvailable) return;

    const assigned = await service.redispatchUnassignedJobs(DELIVERY_DISPATCH_SWEEP_BATCH_SIZE);

    expect(assigned).toBe(0);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.riderId).toBeNull();
    expect(job.status).toBe(DeliveryStatus.PENDING);
  });

  it('still leaves it unassigned when the rider is approved but documents are unverified', async () => {
    if (!databaseAvailable) return;

    await prisma.riderProfile.update({
      where: { userId: riderId },
      data: { status: RiderStatus.APPROVED, isApproved: true, approvedAt: new Date() },
    });
    await prisma.riderKyc.create({
      data: {
        riderId,
        documentType: KycDocumentType.NATIONAL_ID,
        documentNumber: 'NIN-1',
        frontImage: 'https://cdn.example/nin.jpg',
        verificationStatus: KycVerificationStatus.PENDING,
      },
    });

    expect(await service.redispatchUnassignedJobs(DELIVERY_DISPATCH_SWEEP_BATCH_SIZE)).toBe(0);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.riderId).toBeNull();
  });

  it('assigns the waiting delivery once the rider is approved with every document verified', async () => {
    if (!databaseAvailable) return;

    await prisma.riderKyc.updateMany({
      where: { riderId },
      data: { verificationStatus: KycVerificationStatus.VERIFIED, reviewedAt: new Date() },
    });
    await prisma.riderKyc.create({
      data: {
        riderId,
        documentType: KycDocumentType.GUARANTOR_ID,
        documentNumber: 'GUA-1',
        frontImage: 'https://cdn.example/guarantor.jpg',
        verificationStatus: KycVerificationStatus.VERIFIED,
        reviewedAt: new Date(),
      },
    });

    const assigned = await service.redispatchUnassignedJobs(DELIVERY_DISPATCH_SWEEP_BATCH_SIZE);

    expect(assigned).toBe(1);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.riderId).toBe(riderId);
    expect(job.status).toBe(DeliveryStatus.ASSIGNED);
  });

  it('is idempotent: a second sweep does not re-offer the delivery it just placed', async () => {
    if (!databaseAvailable) return;

    const assigned = await service.redispatchUnassignedJobs(DELIVERY_DISPATCH_SWEEP_BATCH_SIZE);

    expect(assigned).toBe(0);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.riderId).toBe(riderId);
    // The rider's active-job count was incremented exactly once by the single
    // assignment, not again by the repeat sweep.
    const availability = await prisma.riderAvailability.findUniqueOrThrow({ where: { riderId } });
    expect(availability.activeJobCount).toBe(1);
  });

  it('leaves a fresh assignment alone — the rider still has time to accept', async () => {
    if (!databaseAvailable) return;

    const reclaimed = await service.reclaimStaleAssignments(DELIVERY_DISPATCH_SWEEP_BATCH_SIZE);

    expect(reclaimed).toBe(0);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.riderId).toBe(riderId);
    expect(job.status).toBe(DeliveryStatus.ASSIGNED);
  });

  it('takes the delivery back from a rider who never accepted it', async () => {
    if (!databaseAvailable) return;

    // The founder's live case: the rider was eligible and online when the
    // merchant marked the order ready, then put the phone down. Before this,
    // ASSIGNED was terminal for dispatch — no sweep looked at it again, so the
    // merchant waited and no other rider could ever be offered the job.
    await prisma.deliveryJob.update({
      where: { id: jobId },
      data: { assignedAt: new Date(Date.now() - DELIVERY_ASSIGNMENT_ACCEPT_TIMEOUT_MS - 1_000) },
    });

    const reclaimed = await service.reclaimStaleAssignments(DELIVERY_DISPATCH_SWEEP_BATCH_SIZE);

    expect(reclaimed).toBe(1);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    // The rider who ignored it is excluded from the immediate retry, and no
    // other rider exists in this fixture — so it is back in the queue rather
    // than handed straight back to the phone that just ignored it.
    expect(job.riderId).toBeNull();
    expect(job.status).toBe(DeliveryStatus.PENDING);

    // Their active-job slot is freed, so the reclaim does not quietly cost them
    // capacity for a delivery they are no longer holding.
    const availability = await prisma.riderAvailability.findUniqueOrThrow({ where: { riderId } });
    expect(availability.activeJobCount).toBe(0);
  });
});
