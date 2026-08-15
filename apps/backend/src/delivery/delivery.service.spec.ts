import {
  AddressLabel,
  AssignmentMethod,
  DeliveryStatus,
  FulfillmentType,
  OrderPaymentMethod,
  OrderStatus,
  PaymentStatus,
  ProofType,
} from '@prisma/client';

import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { type AssignmentService } from './assignment.service';
import { type DeliveryFeeService } from './delivery-fee.service';
import { DELIVERY_AUDIT_ACTIONS } from './delivery.constants';
import { DeliveryService } from './delivery.service';

import type { AddressRepository } from '../addresses/repositories/address.repository';
import type { AuditService } from '../audit/audit.service';
import type { NotificationService } from '../notifications/notification.service';
import type { OrdersRepository, OrderWithItems } from '../orders/repositories/orders.repository';
import type { PrismaService } from '../prisma/prisma.service';
import type { DeliveryRepository } from './repositories/delivery.repository';
import type {
  CustomerAddress,
  DeliveryJob,
  DeliveryProof,
  DeliveryTracking,
  RiderAvailability,
} from '@prisma/client';

const now = new Date('2026-07-21T12:00:00.000Z');
const orderId = '11111111-1111-1111-1111-111111111111';
const jobId = '22222222-2222-2222-2222-222222222222';
const customerId = '33333333-3333-3333-3333-333333333333';
const merchantId = '44444444-4444-4444-4444-444444444444';
const merchantProfileId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const riderId = '55555555-5555-5555-5555-555555555555';
const nextRiderId = '66666666-6666-6666-6666-666666666666';
const addressId = '77777777-7777-7777-7777-777777777777';
const cartId = '88888888-8888-8888-8888-888888888888';

function makeOrder(overrides: Record<string, unknown> = {}): OrderWithItems {
  return {
    id: orderId,
    customerId,
    merchantId: merchantProfileId,
    cartId,
    orderNumber: 'DPX-20260721-ABC123',
    status: OrderStatus.READY,
    paymentStatus: PaymentStatus.PAID,
    fulfillmentType: FulfillmentType.DELIVERY,
    subtotal: 5000,
    discount: 0,
    tax: 0,
    deliveryFee: 0,
    total: 5000,
    couponCode: null,
    deliveryAddressId: addressId,
    notes: null,
    currency: 'NGN',
    createdAt: now,
    updatedAt: now,
    items: [],
    reservations: [],
    ...overrides,
  } as unknown as OrderWithItems;
}

function makeAddress(overrides: Partial<CustomerAddress> = {}): CustomerAddress {
  return {
    id: addressId,
    customerId,
    label: AddressLabel.HOME,
    recipientName: 'Ada Customer',
    phone: '+2348000000000',
    addressLine1: '1 Delivery Street',
    addressLine2: null,
    landmark: null,
    city: 'Lagos',
    state: 'Lagos',
    country: 'NG',
    postalCode: null,
    latitude: 6.6018,
    longitude: 3.3515,
    isDefault: true,
    isActive: true,
    verifiedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as unknown as CustomerAddress;
}

function makeJob(overrides: Record<string, unknown> = {}): DeliveryJob {
  return {
    id: jobId,
    orderId,
    riderId: null,
    merchantId,
    customerId,
    assignmentMethod: AssignmentMethod.AUTO,
    status: DeliveryStatus.PENDING,
    pickupLatitude: 6.5244,
    pickupLongitude: 3.3792,
    dropoffLatitude: 6.6018,
    dropoffLongitude: 3.3515,
    estimatedDistanceMeters: 9200,
    estimatedDurationSeconds: 1105,
    deliveryFee: 1400,
    assignedAt: null,
    acceptedAt: null,
    pickedUpAt: null,
    arrivedAt: null,
    deliveredAt: null,
    failedAt: null,
    cancelledAt: null,
    returnedAt: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as DeliveryJob;
}

function makeRiderAvailability(
  id = riderId,
  overrides: Partial<RiderAvailability> = {},
): RiderAvailability {
  return {
    riderId: id,
    online: true,
    acceptingOrders: true,
    latitude: 6.53,
    longitude: 3.38,
    activeJobCount: 0,
    updatedAt: now,
    ...overrides,
  } as unknown as RiderAvailability;
}

function makeTracking(overrides: Partial<DeliveryTracking> = {}): DeliveryTracking {
  return {
    id: '99999999-9999-9999-9999-999999999999',
    deliveryJobId: jobId,
    latitude: 6.55,
    longitude: 3.36,
    heading: null,
    speed: null,
    accuracy: null,
    createdAt: now,
    ...overrides,
  } as unknown as DeliveryTracking;
}

function makeProof(overrides: Partial<DeliveryProof> = {}): DeliveryProof {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    deliveryJobId: jobId,
    proofType: ProofType.PHOTO,
    photoUrl: 'https://cdn.example/proof.jpg',
    otp: null,
    signatureUrl: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('DeliveryService', () => {
  const deliveryRepository: jest.Mocked<DeliveryRepository> = {
    createJob: jest.fn(),
    findJobById: jest.fn(),
    findJobByOrderId: jest.fn(),
    findJobByOrderForCustomer: jest.fn(),
    listJobs: jest.fn(),
    listRiderJobs: jest.fn(),
    updateJobStatus: jest.fn(),
    confirmCash: jest.fn(),
    assignRider: jest.fn(),
    clearRider: jest.fn(),
    createTracking: jest.fn(),
    findLatestTracking: jest.fn(),
    findTrackingHistory: jest.fn(),
    createProof: jest.fn(),
    findProofs: jest.fn(),
    upsertRiderAvailability: jest.fn(),
    findRiderAvailability: jest.fn(),
    listAvailableRiders: jest.fn(),
    incrementRiderActiveJobCount: jest.fn(),
    decrementRiderActiveJobCount: jest.fn(),
  };

  const ordersRepository: jest.Mocked<OrdersRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdForCustomer: jest.fn(),
    findByIdForMerchant: jest.fn(),
    list: jest.fn(),
    transition: jest.fn(),
    findByCartId: jest.fn(),
    createReservations: jest.fn(),
    releaseReservationsForOrder: jest.fn(),
    findExpiredActiveReservations: jest.fn(),
    findUnpaidOrdersWithExpiredReservations: jest.fn(),
    findAutoCompletableOrders: jest.fn(),
    createDispute: jest.fn(),
    findDisputeById: jest.fn(),
    findOpenDisputeForOrder: jest.fn(),
    resolveDispute: jest.fn(),
  };

  const addressRepository: jest.Mocked<AddressRepository> = {
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findById: jest.fn(),
    findByIdForCustomer: jest.fn(),
    listByCustomerId: jest.fn(),
    countByCustomerId: jest.fn(),
    findDefault: jest.fn(),
    setDefault: jest.fn(),
  };

  const notifications: jest.Mocked<NotificationService> = {
    sendPasswordReset: jest.fn(),
    sendPasswordChanged: jest.fn(),
    sendEmailVerification: jest.fn(),
    sendEmailOtp: jest.fn(),
    sendPhoneOtp: jest.fn(),
    notifyMerchantLifecycle: jest.fn(),
    notifyOrderCreated: jest.fn(),
    notifyOrderLifecycle: jest.fn(),
    notifyPaymentResult: jest.fn(),
    notifyDeliveryLifecycle: jest.fn(),
    notifyDriverLifecycle: jest.fn(),
    notifyRideLifecycle: jest.fn(),
    notifyRideEarning: jest.fn(),
  };

  const assignmentService = {
    findNearestRider: jest.fn(),
  } as unknown as jest.Mocked<AssignmentService>;

  const deliveryFeeService = {
    estimate: jest.fn(),
  } as unknown as jest.Mocked<DeliveryFeeService>;

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const businessFindUnique = jest.fn();
  const userFindUnique = jest.fn();
  const merchantProfileFindUnique = jest.fn();
  const prisma = {
    business: { findUnique: businessFindUnique },
    user: { findUnique: userFindUnique },
    merchantProfile: { findUnique: merchantProfileFindUnique },
  } as unknown as PrismaService;

  const service = new DeliveryService(
    deliveryRepository,
    ordersRepository,
    addressRepository,
    notifications,
    assignmentService,
    deliveryFeeService,
    auditService,
    prisma,
  );

  beforeEach(() => {
    jest.clearAllMocks();

    ordersRepository.findById.mockResolvedValue(makeOrder());
    ordersRepository.transition.mockResolvedValue(makeOrder());
    deliveryRepository.findJobByOrderId.mockResolvedValue(null);
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ASSIGNED }),
    );
    deliveryRepository.findJobByOrderForCustomer.mockResolvedValue(makeJob());
    deliveryRepository.createJob.mockResolvedValue(makeJob());
    deliveryRepository.assignRider.mockImplementation((id, assignedRiderId, assignmentMethod) =>
      Promise.resolve(
        makeJob({
          id,
          riderId: assignedRiderId,
          assignmentMethod,
          status: DeliveryStatus.ASSIGNED,
          deliveryFee: 900,
          assignedAt: now,
        }),
      ),
    );
    deliveryRepository.clearRider.mockResolvedValue(
      makeJob({ riderId: null, status: DeliveryStatus.PENDING }),
    );
    deliveryRepository.updateJobStatus.mockImplementation((id, status, input) =>
      Promise.resolve(
        makeJob({
          id,
          riderId,
          status,
          cancellationReason: input?.cancellationReason ?? null,
        }),
      ),
    );
    deliveryRepository.createProof.mockResolvedValue(makeProof());
    deliveryRepository.findProofs.mockResolvedValue([makeProof()]);
    deliveryRepository.findTrackingHistory.mockResolvedValue([makeTracking()]);
    deliveryRepository.findLatestTracking.mockResolvedValue(makeTracking());
    deliveryRepository.listRiderJobs.mockResolvedValue([
      makeJob({ riderId, status: DeliveryStatus.ACCEPTED }),
    ]);
    deliveryRepository.listJobs.mockResolvedValue({
      items: [makeJob({ status: DeliveryStatus.ACCEPTED })],
      total: 13,
    });
    deliveryRepository.upsertRiderAvailability.mockResolvedValue(makeRiderAvailability());
    deliveryRepository.incrementRiderActiveJobCount.mockResolvedValue(makeRiderAvailability());
    deliveryRepository.decrementRiderActiveJobCount.mockResolvedValue(
      makeRiderAvailability(riderId, {
        activeJobCount: 0,
      }),
    );

    addressRepository.findByIdForCustomer.mockResolvedValue(makeAddress());
    assignmentService.findNearestRider.mockResolvedValue(null);
    deliveryFeeService.estimate.mockReturnValue({
      fee: 900,
      distanceMeters: 1000,
      durationSeconds: 120,
    });
    businessFindUnique.mockResolvedValue({
      merchantId,
      latitude: 6.5244,
      longitude: 3.3792,
    });
    userFindUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      const emails: Record<string, string> = {
        [customerId]: 'customer@example.com',
        [merchantId]: 'merchant@example.com',
        [riderId]: 'rider@example.com',
        [nextRiderId]: 'next-rider@example.com',
      };
      const email = emails[where.id] ?? null;
      return Promise.resolve({ id: where.id, email });
    });
    merchantProfileFindUnique.mockResolvedValue({ id: merchantProfileId, userId: merchantId });
  });

  it('creates a delivery job for a paid order and auto-assigns the nearest rider', async () => {
    assignmentService.findNearestRider.mockResolvedValue(makeRiderAvailability(riderId));

    const result = await service.createDeliveryJob(orderId, { userId: merchantId });

    expect(result).toMatchObject({
      id: jobId,
      riderId,
      status: DeliveryStatus.ASSIGNED,
      deliveryFee: 900,
    });
    expect(deliveryRepository.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        merchantId,
        customerId,
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        dropoffLatitude: 6.6018,
        dropoffLongitude: 3.3515,
        deliveryFee: 900,
        estimatedDistanceMeters: 1000,
        estimatedDurationSeconds: 120,
        assignmentMethod: AssignmentMethod.AUTO,
      }),
    );
    expect(assignmentService.findNearestRider).toHaveBeenCalledWith(6.5244, 3.3792, []);
    expect(deliveryRepository.assignRider).toHaveBeenCalledWith(
      jobId,
      riderId,
      AssignmentMethod.AUTO,
    );
  });

  it('leaves a newly created job pending when no rider is available', async () => {
    const result = await service.createDeliveryJob(orderId);

    expect(result.status).toBe(DeliveryStatus.PENDING);
    expect(result.riderId).toBeNull();
    expect(deliveryRepository.assignRider).not.toHaveBeenCalled();
  });

  it('rejects non-delivery fulfillment orders', async () => {
    ordersRepository.findById.mockResolvedValue(
      makeOrder({ fulfillmentType: FulfillmentType.PICKUP }),
    );

    await expect(service.createDeliveryJob(orderId)).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('rejects orders that are not ready', async () => {
    ordersRepository.findById.mockResolvedValue(makeOrder({ status: OrderStatus.PENDING }));

    await expect(service.createDeliveryJob(orderId)).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('rejects prepaid orders with unpaid payment status', async () => {
    ordersRepository.findById.mockResolvedValue(
      makeOrder({ paymentStatus: PaymentStatus.PENDING, paymentMethod: OrderPaymentMethod.WALLET }),
    );

    await expect(service.createDeliveryJob(orderId)).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('creates a delivery job for a CASH order while payment is still pending (cash on delivery)', async () => {
    assignmentService.findNearestRider.mockResolvedValue(makeRiderAvailability(riderId));
    ordersRepository.findById.mockResolvedValue(
      makeOrder({ paymentStatus: PaymentStatus.PENDING, paymentMethod: OrderPaymentMethod.CASH }),
    );

    const result = await service.createDeliveryJob(orderId, { userId: merchantId });

    expect(result).toMatchObject({ id: jobId, riderId, status: DeliveryStatus.ASSIGNED });
    expect(deliveryRepository.createJob).toHaveBeenCalled();
  });

  it('returns an existing delivery job idempotently', async () => {
    const existing = makeJob({ status: DeliveryStatus.ACCEPTED, riderId });
    deliveryRepository.findJobByOrderId.mockResolvedValue(existing);

    const result = await service.createDeliveryJob(orderId);

    expect(result.status).toBe(DeliveryStatus.ACCEPTED);
    expect(deliveryRepository.createJob).not.toHaveBeenCalled();
  });

  it('rejects paid delivery orders without a delivery address', async () => {
    ordersRepository.findById.mockResolvedValue(makeOrder({ deliveryAddressId: null }));

    await expect(service.createDeliveryJob(orderId)).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('rejects paid delivery orders with a missing address', async () => {
    addressRepository.findByIdForCustomer.mockResolvedValue(null);

    await expect(service.createDeliveryJob(orderId)).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });

  it('uses default pickup coordinates when the merchant business is missing', async () => {
    businessFindUnique.mockResolvedValue(null);

    await service.createDeliveryJob(orderId);

    expect(deliveryRepository.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
      }),
    );
  });

  it('passes an existing order delivery fee as the merchant override estimate', async () => {
    ordersRepository.findById.mockResolvedValue(makeOrder({ deliveryFee: 750 }));

    await service.createDeliveryJob(orderId);

    expect(deliveryFeeService.estimate).toHaveBeenCalledWith(expect.any(Number), 750);
  });

  it('assigns a rider manually', async () => {
    deliveryRepository.findJobById.mockResolvedValue(makeJob({ status: DeliveryStatus.PENDING }));

    const result = await service.assignRider(jobId, riderId, AssignmentMethod.MANUAL, {
      userId: merchantId,
    });

    expect(result.riderId).toBe(riderId);
    expect(result.assignmentMethod).toBe(AssignmentMethod.MANUAL);
    expect(deliveryRepository.incrementRiderActiveJobCount).toHaveBeenCalledWith(riderId);
    expect(auditService.record).toHaveBeenCalledWith(
      DELIVERY_AUDIT_ACTIONS.ASSIGNED,
      { userId: merchantId },
      expect.objectContaining({ resource: 'delivery_job', resourceId: jobId }),
    );
  });

  it('notifies the rider and customer on assignment', async () => {
    deliveryRepository.findJobById.mockResolvedValue(makeJob({ status: DeliveryStatus.PENDING }));

    await service.assignRider(jobId, riderId, AssignmentMethod.MANUAL, {});

    expect(notifications.notifyDeliveryLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'rider',
        email: 'rider@example.com',
        event: 'new_assignment',
      }),
    );
    expect(notifications.notifyDeliveryLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'customer',
        email: 'customer@example.com',
        event: 'rider_assigned',
      }),
    );
  });

  it('reassigns from the previous rider to a new rider', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ASSIGNED }),
    );

    const result = await service.reassignRider(jobId, nextRiderId, { userId: merchantId });

    expect(result.riderId).toBe(nextRiderId);
    expect(deliveryRepository.decrementRiderActiveJobCount).toHaveBeenCalledWith(riderId);
    expect(deliveryRepository.incrementRiderActiveJobCount).toHaveBeenCalledWith(nextRiderId);
  });

  it('does not change rider capacity when assigning the same rider again', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ASSIGNED }),
    );

    await service.assignRider(jobId, riderId, AssignmentMethod.MANUAL, {});

    expect(deliveryRepository.decrementRiderActiveJobCount).not.toHaveBeenCalled();
    expect(deliveryRepository.incrementRiderActiveJobCount).not.toHaveBeenCalled();
  });

  it('rejects assignment to terminal delivery jobs', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ status: DeliveryStatus.DELIVERED, riderId }),
    );

    await expect(
      service.assignRider(jobId, nextRiderId, AssignmentMethod.MANUAL, {}),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('accepts an assigned job and updates the order to processing', async () => {
    deliveryRepository.updateJobStatus.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ACCEPTED, acceptedAt: now }),
    );

    const result = await service.acceptJob(riderId, jobId, { userId: riderId });

    expect(result.status).toBe(DeliveryStatus.ACCEPTED);
    expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
      status: OrderStatus.DRIVER_ASSIGNED,
    });
    expect(auditService.record).toHaveBeenCalledWith(
      DELIVERY_AUDIT_ACTIONS.ACCEPTED,
      { userId: riderId },
      expect.objectContaining({
        resource: 'delivery_job',
        resourceId: jobId,
      }),
    );
  });

  it('rejects acceptJob when the delivery is not assigned', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.PENDING }),
    );

    await expect(service.acceptJob(riderId, jobId, {})).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('rejects a rider job and clears rider assignment', async () => {
    const result = await service.rejectJob(riderId, jobId, { userId: riderId });

    expect(result.status).toBe(DeliveryStatus.PENDING);
    expect(result.riderId).toBeNull();
    expect(deliveryRepository.clearRider).toHaveBeenCalledWith(jobId);
    expect(deliveryRepository.decrementRiderActiveJobCount).toHaveBeenCalledWith(riderId);
  });

  it('retries auto-assignment after a rider rejects a job', async () => {
    assignmentService.findNearestRider.mockResolvedValue(makeRiderAvailability(nextRiderId));

    const result = await service.rejectJob(riderId, jobId, {});

    expect(result.riderId).toBe(nextRiderId);
    expect(assignmentService.findNearestRider).toHaveBeenCalledWith(6.5244, 3.3792, [riderId]);
    expect(deliveryRepository.assignRider).toHaveBeenCalledWith(
      jobId,
      nextRiderId,
      AssignmentMethod.AUTO,
    );
  });

  it('picks up an accepted job and updates the order out for delivery', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ACCEPTED }),
    );
    deliveryRepository.updateJobStatus.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.PICKED_UP, pickedUpAt: now }),
    );

    const result = await service.pickUp(riderId, jobId, { userId: riderId });

    expect(result.status).toBe(DeliveryStatus.PICKED_UP);
    expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
      status: OrderStatus.PICKED_UP,
    });
    expect(notifications.notifyDeliveryLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'customer', event: 'picked_up' }),
    );
  });

  it('marks a picked-up job on the way', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.PICKED_UP }),
    );

    const result = await service.markOnTheWay(riderId, jobId, { userId: riderId });

    expect(result.status).toBe(DeliveryStatus.ON_THE_WAY);
    expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
      status: OrderStatus.IN_TRANSIT,
    });
    expect(auditService.record).toHaveBeenCalledWith(
      DELIVERY_AUDIT_ACTIONS.LOCATION_UPDATED,
      { userId: riderId },
      expect.objectContaining({
        metadata: expect.objectContaining({ status: DeliveryStatus.ON_THE_WAY }),
      }),
    );
  });

  it('marks an on-the-way job as arrived', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ON_THE_WAY }),
    );
    deliveryRepository.updateJobStatus.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ARRIVED, arrivedAt: now }),
    );

    const result = await service.arrived(riderId, jobId, { userId: riderId });

    expect(result.status).toBe(DeliveryStatus.ARRIVED);
    expect(notifications.notifyDeliveryLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'customer', event: 'arriving' }),
    );
  });

  it('rejects arrived from pending status', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.PENDING }),
    );

    await expect(service.arrived(riderId, jobId, {})).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('delivers with photo proof', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ARRIVED }),
    );

    const result = await service.deliver(
      riderId,
      jobId,
      { proofType: ProofType.PHOTO, photoUrl: 'https://cdn.example/proof.jpg' },
      { userId: riderId },
    );

    expect(result.status).toBe(DeliveryStatus.DELIVERED);
    expect(deliveryRepository.createProof).toHaveBeenCalledWith({
      deliveryJobId: jobId,
      proofType: ProofType.PHOTO,
      photoUrl: 'https://cdn.example/proof.jpg',
    });
    expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
      status: OrderStatus.DELIVERED,
      deliveredAt: expect.any(Date),
    });
  });

  it('delivers with OTP proof', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ARRIVED }),
    );

    await service.deliver(riderId, jobId, { proofType: ProofType.OTP, otp: '123456' }, {});

    expect(deliveryRepository.createProof).toHaveBeenCalledWith({
      deliveryJobId: jobId,
      proofType: ProofType.OTP,
      otp: '123456',
    });
  });

  it('delivers with photo and OTP proof', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ARRIVED }),
    );

    await service.deliver(
      riderId,
      jobId,
      {
        proofType: ProofType.PHOTO_AND_OTP,
        photoUrl: 'https://cdn.example/proof.jpg',
        otp: '123456',
      },
      {},
    );

    expect(deliveryRepository.createProof).toHaveBeenCalledWith({
      deliveryJobId: jobId,
      proofType: ProofType.PHOTO_AND_OTP,
      photoUrl: 'https://cdn.example/proof.jpg',
      otp: '123456',
    });
  });

  it('delivers with signature proof', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ARRIVED }),
    );

    await service.deliver(
      riderId,
      jobId,
      { proofType: ProofType.SIGNATURE, signatureUrl: 'https://cdn.example/signature.png' },
      {},
    );

    expect(deliveryRepository.createProof).toHaveBeenCalledWith({
      deliveryJobId: jobId,
      proofType: ProofType.SIGNATURE,
      signatureUrl: 'https://cdn.example/signature.png',
    });
  });

  it('notifies customer and merchant after delivery', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ARRIVED }),
    );

    await service.deliver(
      riderId,
      jobId,
      { proofType: ProofType.PHOTO, photoUrl: 'https://cdn.example/proof.jpg' },
      {},
    );

    expect(notifications.notifyDeliveryLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'customer', event: 'delivered' }),
    );
    expect(notifications.notifyDeliveryLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'merchant', event: 'delivered' }),
    );
  });

  it('audits completed delivery with proof type', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ARRIVED }),
    );

    await service.deliver(
      riderId,
      jobId,
      { proofType: ProofType.OTP, otp: '123456' },
      { userId: riderId },
    );

    expect(auditService.record).toHaveBeenCalledWith(
      DELIVERY_AUDIT_ACTIONS.COMPLETED,
      { userId: riderId },
      expect.objectContaining({
        metadata: expect.objectContaining({ proofType: ProofType.OTP }),
      }),
    );
  });

  it('rejects incomplete photo proof', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ARRIVED }),
    );

    await expect(
      service.deliver(riderId, jobId, { proofType: ProofType.PHOTO }, {}),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('rejects incomplete OTP proof', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ARRIVED }),
    );

    await expect(
      service.deliver(riderId, jobId, { proofType: ProofType.OTP }, {}),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('rejects incomplete photo and OTP proof', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ARRIVED }),
    );

    await expect(
      service.deliver(
        riderId,
        jobId,
        { proofType: ProofType.PHOTO_AND_OTP, photoUrl: 'https://cdn.example/proof.jpg' },
        {},
      ),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('rejects delivery before arrival', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ON_THE_WAY }),
    );

    await expect(
      service.deliver(
        riderId,
        jobId,
        { proofType: ProofType.PHOTO, photoUrl: 'https://cdn.example/proof.jpg' },
        {},
      ),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  describe('DPX-COMMERCIAL-001 Slice 3 — confirmCash()', () => {
    it('confirms cash collection on a delivered CASH order', async () => {
      deliveryRepository.findJobById.mockResolvedValue(
        makeJob({ riderId, status: DeliveryStatus.DELIVERED }),
      );
      ordersRepository.findById.mockResolvedValue(
        makeOrder({ paymentMethod: OrderPaymentMethod.CASH, total: 5000 }),
      );
      const confirmed = makeJob({
        riderId,
        status: DeliveryStatus.DELIVERED,
        cashCollectedAmount: 5000,
        cashConfirmedAt: now,
      });
      deliveryRepository.confirmCash.mockResolvedValue(confirmed);

      const result = await service.confirmCash(riderId, jobId, 5000, { userId: riderId });

      expect(deliveryRepository.confirmCash).toHaveBeenCalledWith(jobId, 5000);
      expect(result.cashCollectedAmount).toBe(5000);
      expect(auditService.record).toHaveBeenCalledWith(
        DELIVERY_AUDIT_ACTIONS.CASH_CONFIRMED,
        { userId: riderId },
        expect.objectContaining({
          metadata: expect.objectContaining({
            amountCollected: 5000,
            orderTotal: 5000,
            matchesOrderTotal: true,
          }),
        }),
      );
    });

    it('rejects confirming cash before the job is DELIVERED', async () => {
      deliveryRepository.findJobById.mockResolvedValue(
        makeJob({ riderId, status: DeliveryStatus.ON_THE_WAY }),
      );

      await expect(service.confirmCash(riderId, jobId, 5000, {})).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
      expect(deliveryRepository.confirmCash).not.toHaveBeenCalled();
    });

    it('rejects a non-positive amount collected', async () => {
      deliveryRepository.findJobById.mockResolvedValue(
        makeJob({ riderId, status: DeliveryStatus.DELIVERED }),
      );

      await expect(service.confirmCash(riderId, jobId, 0, {})).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
      expect(deliveryRepository.confirmCash).not.toHaveBeenCalled();
    });

    it('rejects cash confirmation on a non-CASH order', async () => {
      deliveryRepository.findJobById.mockResolvedValue(
        makeJob({ riderId, status: DeliveryStatus.DELIVERED }),
      );
      ordersRepository.findById.mockResolvedValue(
        makeOrder({ paymentMethod: OrderPaymentMethod.WALLET }),
      );

      await expect(service.confirmCash(riderId, jobId, 5000, {})).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
      expect(deliveryRepository.confirmCash).not.toHaveBeenCalled();
    });

    it('is idempotent — a second confirmation on an already-confirmed job is a no-op', async () => {
      const alreadyConfirmed = makeJob({
        riderId,
        status: DeliveryStatus.DELIVERED,
        cashCollectedAmount: 5000,
        cashConfirmedAt: now,
      });
      deliveryRepository.findJobById.mockResolvedValue(alreadyConfirmed);

      const result = await service.confirmCash(riderId, jobId, 5000, {});

      expect(result.cashCollectedAmount).toBe(5000);
      expect(deliveryRepository.confirmCash).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  it('fails an active job with a reason and releases rider capacity', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ON_THE_WAY }),
    );

    const result = await service.fail(riderId, jobId, 'customer unavailable', {
      userId: riderId,
    });

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(deliveryRepository.updateJobStatus).toHaveBeenCalledWith(jobId, DeliveryStatus.FAILED, {
      cancellationReason: 'customer unavailable',
    });
    expect(deliveryRepository.decrementRiderActiveJobCount).toHaveBeenCalledWith(riderId);
  });

  it('fails an active job with a null reason when none is provided', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ACCEPTED }),
    );

    await service.fail(riderId, jobId, undefined, {});

    expect(deliveryRepository.updateJobStatus).toHaveBeenCalledWith(jobId, DeliveryStatus.FAILED, {
      cancellationReason: null,
    });
  });

  it('returns a picked-up job and releases rider capacity', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.PICKED_UP }),
    );

    const result = await service.returnJob(riderId, jobId, 'merchant requested return', {});

    expect(result.status).toBe(DeliveryStatus.RETURNED);
    expect(deliveryRepository.updateJobStatus).toHaveBeenCalledWith(
      jobId,
      DeliveryStatus.RETURNED,
      { cancellationReason: 'merchant requested return' },
    );
    expect(deliveryRepository.decrementRiderActiveJobCount).toHaveBeenCalledWith(riderId);
  });

  it('cancels a pending unassigned job without releasing rider capacity', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId: null, status: DeliveryStatus.PENDING }),
    );

    const result = await service.cancelJob(jobId, 'customer cancelled', { userId: customerId });

    expect(result.status).toBe(DeliveryStatus.CANCELLED);
    expect(deliveryRepository.decrementRiderActiveJobCount).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      DELIVERY_AUDIT_ACTIONS.CANCELLED,
      { userId: customerId },
      expect.objectContaining({
        metadata: expect.objectContaining({ reason: 'customer cancelled' }),
      }),
    );
  });

  it('cancels an assigned active job and releases rider capacity', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId, status: DeliveryStatus.ACCEPTED }),
    );

    await service.cancelJob(jobId, undefined, {});

    expect(deliveryRepository.decrementRiderActiveJobCount).toHaveBeenCalledWith(riderId);
    expect(deliveryRepository.updateJobStatus).toHaveBeenCalledWith(
      jobId,
      DeliveryStatus.CANCELLED,
      {
        cancellationReason: null,
      },
    );
  });

  it('rejects cancellation for terminal jobs', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ status: DeliveryStatus.DELIVERED, riderId }),
    );

    await expect(service.cancelJob(jobId, 'too late', {})).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('gets a customer delivery by order id', async () => {
    const result = await service.getCustomerDelivery(customerId, orderId);

    expect(result.id).toBe(jobId);
    expect(deliveryRepository.findJobByOrderForCustomer).toHaveBeenCalledWith(orderId, customerId);
    expect(result.riderName).toBeNull();
    expect(result.riderPhone).toBeNull();
  });

  it('enriches a customer delivery with the assigned rider name and phone', async () => {
    deliveryRepository.findJobByOrderForCustomer.mockResolvedValue(makeJob({ riderId }));
    userFindUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === riderId) {
        return Promise.resolve({
          id: riderId,
          firstName: 'Emeka',
          lastName: 'Okafor',
          phone: '+2348011112222',
          email: 'rider@example.com',
        });
      }
      return Promise.resolve(null);
    });

    const result = await service.getCustomerDelivery(customerId, orderId);

    expect(result.riderName).toBe('Emeka Okafor');
    expect(result.riderPhone).toBe('+2348011112222');
  });

  it('rejects missing customer delivery', async () => {
    deliveryRepository.findJobByOrderForCustomer.mockResolvedValue(null);

    await expect(service.getCustomerDelivery(customerId, orderId)).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });

  it('gets customer tracking history', async () => {
    const result = await service.getCustomerTracking(customerId, orderId);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ deliveryJobId: jobId, latitude: 6.55 });
    expect(deliveryRepository.findTrackingHistory).toHaveBeenCalledWith(jobId);
  });

  it('gets customer ETA from latest tracking', async () => {
    deliveryRepository.findJobByOrderForCustomer.mockResolvedValue(
      makeJob({ status: DeliveryStatus.ON_THE_WAY }),
    );

    const result = await service.getCustomerEta(customerId, orderId);

    expect(result).toMatchObject({
      jobId,
      orderId,
      status: DeliveryStatus.ON_THE_WAY,
    });
    expect(result.lastKnownLocation).toMatchObject({ deliveryJobId: jobId });
  });

  it('lists rider jobs', async () => {
    const result = await service.listRiderJobs(riderId);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ riderId, status: DeliveryStatus.ACCEPTED });
  });

  it('gets a rider job assigned to that rider', async () => {
    const result = await service.getRiderJob(riderId, jobId);

    expect(result.riderId).toBe(riderId);
  });

  it('rejects getRiderJob for the wrong rider', async () => {
    deliveryRepository.findJobById.mockResolvedValue(
      makeJob({ riderId: nextRiderId, status: DeliveryStatus.ASSIGNED }),
    );

    await expect(service.getRiderJob(riderId, jobId)).rejects.toBeInstanceOf(
      ForbiddenDomainException,
    );
  });

  it('lists admin jobs with filters and pagination metadata', async () => {
    const result = await service.listAdminJobs({
      status: DeliveryStatus.ACCEPTED,
      riderId,
      merchantId,
      customerId,
      page: 2,
      pageSize: 5,
    });

    expect(deliveryRepository.listJobs).toHaveBeenCalledWith({
      status: DeliveryStatus.ACCEPTED,
      riderId,
      merchantId,
      customerId,
      skip: 5,
      take: 5,
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 5,
      total: 13,
      totalPages: 3,
    });
  });

  it('gets an admin job by id', async () => {
    const result = await service.getAdminJob(jobId);

    expect(result.id).toBe(jobId);
  });

  it('finds proofs for an existing job', async () => {
    const result = await service.findProofs(jobId);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      deliveryJobId: jobId,
      proofType: ProofType.PHOTO,
      photoUrl: 'https://cdn.example/proof.jpg',
    });
  });

  it('updates rider availability with location', async () => {
    const result = await service.updateRiderAvailability(riderId, {
      online: true,
      acceptingOrders: true,
      latitude: 6.53,
      longitude: 3.38,
    });

    expect(deliveryRepository.upsertRiderAvailability).toHaveBeenCalledWith({
      riderId,
      online: true,
      acceptingOrders: true,
      latitude: 6.53,
      longitude: 3.38,
    });
    expect(result).toMatchObject({
      riderId,
      online: true,
      acceptingOrders: true,
      latitude: 6.53,
      longitude: 3.38,
    });
  });

  it('returns the rider’s stored availability so the app need not assume offline', async () => {
    deliveryRepository.findRiderAvailability.mockResolvedValue(makeRiderAvailability());

    const result = await service.getOwnRiderAvailability(riderId);

    expect(deliveryRepository.findRiderAvailability).toHaveBeenCalledWith(riderId);
    expect(result).toMatchObject({ riderId, online: true, latitude: 6.53, longitude: 3.38 });
  });

  it('reports null availability for a rider who has never gone online', async () => {
    deliveryRepository.findRiderAvailability.mockResolvedValue(null);

    expect(await service.getOwnRiderAvailability(riderId)).toBeNull();
  });
});
