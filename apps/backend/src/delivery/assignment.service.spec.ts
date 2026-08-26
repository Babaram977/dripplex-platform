import { AssignmentService } from './assignment.service';
import { MAX_RIDER_ACTIVE_JOBS } from './delivery.constants';

import type {
  CourierType,
  DeliveryCandidate,
  DeliveryRepository,
} from './repositories/delivery.repository';

function makeAvailability(
  userId: string,
  latitude: number | null,
  longitude: number | null,
  courierType: CourierType = 'RIDER',
): DeliveryCandidate {
  return {
    userId,
    latitude,
    longitude,
    courierType,
  } as unknown as DeliveryCandidate;
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
    listAvailableCouriers: jest.fn(),
    resolveEligibleCourier: jest.fn(),
    incrementActiveJobCount: jest.fn(),
    decrementActiveJobCount: jest.fn(),
  };

  const service = new AssignmentService(deliveryRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    deliveryRepository.listAvailableCouriers.mockResolvedValue([]);
  });

  it('returns null when nobody is available', async () => {
    await expect(service.findNearestCourier(6.5244, 3.3792)).resolves.toBeNull();
    expect(deliveryRepository.listAvailableCouriers).toHaveBeenCalledWith(MAX_RIDER_ACTIVE_JOBS);
  });

  it('picks the nearest available rider by haversine distance', async () => {
    const near = makeAvailability('near-rider', 6.525, 3.38);
    const far = makeAvailability('far-rider', 6.65, 3.5);
    deliveryRepository.listAvailableCouriers.mockResolvedValue([far, near]);

    await expect(service.findNearestCourier(6.5244, 3.3792)).resolves.toEqual(near);
  });

  it('ignores riders without coordinates', async () => {
    const withCoordinates = makeAvailability('with-coordinates', 6.525, 3.38);
    deliveryRepository.listAvailableCouriers.mockResolvedValue([
      makeAvailability('no-latitude', null, 3.38),
      makeAvailability('no-longitude', 6.525, null),
      withCoordinates,
    ]);

    await expect(service.findNearestCourier(6.5244, 3.3792)).resolves.toEqual(withCoordinates);
  });

  it('returns null when the only online rider has no coordinates', async () => {
    // The live failure: the rider app went online without sending a position,
    // so the one approved rider was online and accepting but invisible to
    // dispatch — the job was created and never assigned to anyone.
    deliveryRepository.listAvailableCouriers.mockResolvedValue([
      makeAvailability('online-but-unlocated', null, null),
    ]);

    await expect(service.findNearestCourier(6.5244, 3.3792)).resolves.toBeNull();
  });

  it('offers a delivery to the nearest opted-in DRIVER when they beat every courier', async () => {
    // The founder's change: a driver who turned deliveries on competes on
    // distance like anyone else. Ranking couriers first regardless would mean
    // a driver who opted in almost never sees a job and concludes it is
    // broken.
    const farCourier = makeAvailability('far-courier', 6.65, 3.5, 'RIDER');
    const nearDriver = makeAvailability('near-driver', 6.525, 3.38, 'DRIVER');
    deliveryRepository.listAvailableCouriers.mockResolvedValue([farCourier, nearDriver]);

    const chosen = await service.findNearestCourier(6.5244, 3.3792);

    expect(chosen).toEqual(nearDriver);
    // The pool it came from travels with it — settlement and the active-job
    // counter both depend on it downstream.
    expect(chosen?.courierType).toBe('DRIVER');
  });

  it('excludes couriers that already rejected a job', async () => {
    const excluded = makeAvailability('excluded-rider', 6.5245, 3.3793);
    const nextBest = makeAvailability('next-best-rider', 6.53, 3.39);
    deliveryRepository.listAvailableCouriers.mockResolvedValue([excluded, nextBest]);

    await expect(service.findNearestCourier(6.5244, 3.3792, ['excluded-rider'])).resolves.toEqual(
      nextBest,
    );
  });
});
