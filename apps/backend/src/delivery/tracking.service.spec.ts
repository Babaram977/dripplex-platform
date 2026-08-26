import { AssignmentMethod, DeliveryStatus } from '@prisma/client';

import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { DELIVERY_AUDIT_ACTIONS, TRACKING_THROTTLE_MS } from './delivery.constants';
import { TrackingService } from './tracking.service';

import type { AuditService } from '../audit/audit.service';
import type { DeliveryRepository } from './repositories/delivery.repository';
import type { DeliveryJob, DeliveryTracking } from '@prisma/client';

const now = new Date('2026-07-21T12:00:00.000Z');
const jobId = '11111111-1111-1111-1111-111111111111';
const riderId = '22222222-2222-2222-2222-222222222222';

function makeJob(overrides: Partial<DeliveryJob> = {}): DeliveryJob {
  return {
    id: jobId,
    orderId: '33333333-3333-3333-3333-333333333333',
    riderId,
    merchantId: '44444444-4444-4444-4444-444444444444',
    customerId: '55555555-5555-5555-5555-555555555555',
    assignmentMethod: AssignmentMethod.AUTO,
    status: DeliveryStatus.ACCEPTED,
    pickupLatitude: 6.5244,
    pickupLongitude: 3.3792,
    dropoffLatitude: 6.6018,
    dropoffLongitude: 3.3515,
    estimatedDistanceMeters: 9200,
    estimatedDurationSeconds: 1105,
    deliveryFee: 1400,
    assignedAt: now,
    acceptedAt: now,
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

function makeTracking(overrides: Partial<DeliveryTracking> = {}): DeliveryTracking {
  return {
    id: '66666666-6666-6666-6666-666666666666',
    deliveryJobId: jobId,
    latitude: 6.53,
    longitude: 3.38,
    heading: null,
    speed: null,
    accuracy: null,
    createdAt: now,
    ...overrides,
  } as unknown as DeliveryTracking;
}

describe('TrackingService', () => {
  const deliveryRepository: jest.Mocked<DeliveryRepository> = {
    createJob: jest.fn(),
    findJobById: jest.fn(),
    findJobByOrderId: jest.fn(),
    findJobByOrderForCustomer: jest.fn(),
    listJobs: jest.fn(),
    listRiderJobs: jest.fn(),
    listRiderJobHistory: jest.fn(),
    updateJobStatus: jest.fn(),
    confirmCash: jest.fn(),
    assignRider: jest.fn(),
    clearRider: jest.fn(),
    listUnassignedJobs: jest.fn(),
    listStaleAssignedJobs: jest.fn(),
    listRejectedRiderIds: jest.fn(),
    createTracking: jest.fn(),
    findLatestTracking: jest.fn(),
    findTrackingHistory: jest.fn(),
    createProof: jest.fn(),
    findProofs: jest.fn(),
    upsertRiderAvailability: jest.fn(),
    findRiderAvailability: jest.fn(),
    listAvailableRiders: jest.fn(),
    isRiderEligibleForDelivery: jest.fn(),
    incrementRiderActiveJobCount: jest.fn(),
    decrementRiderActiveJobCount: jest.fn(),
  };

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  let service: TrackingService;
  let nowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrackingService(deliveryRepository, auditService);
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    deliveryRepository.findJobById.mockResolvedValue(makeJob());
    deliveryRepository.findLatestTracking.mockResolvedValue(null);
    deliveryRepository.createTracking.mockResolvedValue(makeTracking());
    deliveryRepository.updateJobStatus.mockResolvedValue(
      makeJob({ status: DeliveryStatus.ON_THE_WAY }),
    );
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('rejects missing delivery jobs', async () => {
    deliveryRepository.findJobById.mockResolvedValue(null);

    await expect(
      service.recordLocation(jobId, riderId, { latitude: 6.53, longitude: 3.38 }),
    ).rejects.toBeInstanceOf(NotFoundDomainException);
  });

  it('rejects updates from the wrong rider', async () => {
    await expect(
      service.recordLocation(jobId, 'wrong-rider', { latitude: 6.53, longitude: 3.38 }),
    ).rejects.toBeInstanceOf(ForbiddenDomainException);
  });

  it('rejects invalid delivery statuses', async () => {
    deliveryRepository.findJobById.mockResolvedValue(makeJob({ status: DeliveryStatus.PENDING }));

    await expect(
      service.recordLocation(jobId, riderId, { latitude: 6.53, longitude: 3.38 }),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('records rider location coordinates', async () => {
    const result = await service.recordLocation(jobId, riderId, {
      latitude: 6.53,
      longitude: 3.38,
      heading: 90,
      speed: 7.5,
      accuracy: 4,
    });

    expect(result).toMatchObject({
      id: '66666666-6666-6666-6666-666666666666',
      deliveryJobId: jobId,
      latitude: 6.53,
      longitude: 3.38,
    });
    expect(deliveryRepository.createTracking).toHaveBeenCalledWith({
      deliveryJobId: jobId,
      latitude: 6.53,
      longitude: 3.38,
      heading: 90,
      speed: 7.5,
      accuracy: 4,
    });
  });

  it('audits successful location updates as the rider', async () => {
    await service.recordLocation(
      jobId,
      riderId,
      { latitude: 6.53, longitude: 3.38 },
      { ipAddress: '127.0.0.1' },
    );

    expect(auditService.record).toHaveBeenCalledWith(
      DELIVERY_AUDIT_ACTIONS.LOCATION_UPDATED,
      { ipAddress: '127.0.0.1', userId: riderId },
      {
        resource: 'delivery_job',
        resourceId: jobId,
        metadata: {
          latitude: 6.53,
          longitude: 3.38,
        },
      },
    );
  });

  it('returns latest tracking without creating another row when throttled', async () => {
    const firstTracking = makeTracking({ id: 'first-tracking' });
    deliveryRepository.createTracking.mockResolvedValue(firstTracking);
    deliveryRepository.findLatestTracking
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(firstTracking);

    const first = await service.recordLocation(jobId, riderId, {
      latitude: 6.53,
      longitude: 3.38,
    });
    const second = await service.recordLocation(jobId, riderId, {
      latitude: 6.54,
      longitude: 3.39,
    });

    expect(first.id).toBe('first-tracking');
    expect(second.id).toBe('first-tracking');
    expect(deliveryRepository.createTracking).toHaveBeenCalledTimes(1);
  });

  it('creates another row after the throttle window expires', async () => {
    const firstTracking = makeTracking({ id: 'first-tracking' });
    const secondTracking = makeTracking({ id: 'second-tracking' });
    deliveryRepository.createTracking
      .mockResolvedValueOnce(firstTracking)
      .mockResolvedValueOnce(secondTracking);
    deliveryRepository.findLatestTracking.mockResolvedValue(null);
    nowSpy.mockReturnValueOnce(1_000_000).mockReturnValueOnce(1_000_000 + TRACKING_THROTTLE_MS);

    await service.recordLocation(jobId, riderId, { latitude: 6.53, longitude: 3.38 });
    const result = await service.recordLocation(jobId, riderId, {
      latitude: 6.54,
      longitude: 3.39,
    });

    expect(result.id).toBe('second-tracking');
    expect(deliveryRepository.createTracking).toHaveBeenCalledTimes(2);
  });

  it('transitions PICKED_UP to ON_THE_WAY on the first location after pickup', async () => {
    deliveryRepository.findJobById.mockResolvedValue(makeJob({ status: DeliveryStatus.PICKED_UP }));
    deliveryRepository.findLatestTracking.mockResolvedValue(null);

    await service.recordLocation(jobId, riderId, { latitude: 6.53, longitude: 3.38 });

    expect(deliveryRepository.updateJobStatus).toHaveBeenCalledWith(
      jobId,
      DeliveryStatus.ON_THE_WAY,
    );
  });
});
