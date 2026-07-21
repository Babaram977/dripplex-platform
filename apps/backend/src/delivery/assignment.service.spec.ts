import { AssignmentService } from './assignment.service';
import { MAX_RIDER_ACTIVE_JOBS } from './delivery.constants';

import type { DeliveryRepository } from './repositories/delivery.repository';
import type { RiderAvailability } from '@prisma/client';

const now = new Date('2026-07-21T12:00:00.000Z');

function makeAvailability(
  riderId: string,
  latitude: number | null,
  longitude: number | null,
  activeJobCount = 0,
): RiderAvailability {
  return {
    riderId,
    online: true,
    acceptingOrders: true,
    latitude,
    longitude,
    activeJobCount,
    updatedAt: now,
  } as RiderAvailability;
}

describe('AssignmentService', () => {
  const deliveryRepository: jest.Mocked<DeliveryRepository> = {
    createJob: jest.fn(),
    findJobById: jest.fn(),
    findJobByOrderId: jest.fn(),
    findJobByOrderForCustomer: jest.fn(),
    listJobs: jest.fn(),
    listRiderJobs: jest.fn(),
    updateJobStatus: jest.fn(),
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

  const service = new AssignmentService(deliveryRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    deliveryRepository.listAvailableRiders.mockResolvedValue([]);
  });

  it('returns null when no riders are available', async () => {
    await expect(service.findNearestRider(6.5244, 3.3792)).resolves.toBeNull();
    expect(deliveryRepository.listAvailableRiders).toHaveBeenCalledWith(MAX_RIDER_ACTIVE_JOBS);
  });

  it('picks the nearest available rider by haversine distance', async () => {
    const near = makeAvailability('near-rider', 6.525, 3.38);
    const far = makeAvailability('far-rider', 6.65, 3.5);
    deliveryRepository.listAvailableRiders.mockResolvedValue([far, near]);

    await expect(service.findNearestRider(6.5244, 3.3792)).resolves.toEqual(near);
  });

  it('ignores riders without coordinates', async () => {
    const withCoordinates = makeAvailability('with-coordinates', 6.525, 3.38);
    deliveryRepository.listAvailableRiders.mockResolvedValue([
      makeAvailability('no-latitude', null, 3.38),
      makeAvailability('no-longitude', 6.525, null),
      withCoordinates,
    ]);

    await expect(service.findNearestRider(6.5244, 3.3792)).resolves.toEqual(withCoordinates);
  });

  it('excludes riders that already rejected a job', async () => {
    const excluded = makeAvailability('excluded-rider', 6.5245, 3.3793);
    const nextBest = makeAvailability('next-best-rider', 6.53, 3.39);
    deliveryRepository.listAvailableRiders.mockResolvedValue([excluded, nextBest]);

    await expect(service.findNearestRider(6.5244, 3.3792, ['excluded-rider'])).resolves.toEqual(
      nextBest,
    );
  });
});
