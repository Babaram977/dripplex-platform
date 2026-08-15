import { DeliveryDispatchSweepService } from './delivery-dispatch-sweep.service';
import { DELIVERY_DISPATCH_SWEEP_BATCH_SIZE } from './delivery.constants';

import type { DeliveryService } from './delivery.service';

describe('DeliveryDispatchSweepService', () => {
  const deliveryService = {
    redispatchUnassignedJobs: jest.fn(),
  } as unknown as jest.Mocked<DeliveryService>;

  const service = new DeliveryDispatchSweepService(deliveryService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('re-dispatches a bounded batch per tick', async () => {
    deliveryService.redispatchUnassignedJobs.mockResolvedValue(2);

    await expect(service.runSweep()).resolves.toBe(2);
    expect(deliveryService.redispatchUnassignedJobs).toHaveBeenCalledWith(
      DELIVERY_DISPATCH_SWEEP_BATCH_SIZE,
    );
  });

  it('does not overlap with itself — a slow sweep cannot double-offer a job', async () => {
    let release: () => void = () => undefined;
    deliveryService.redispatchUnassignedJobs.mockReturnValue(
      new Promise<number>((resolve) => {
        release = (): void => {
          resolve(1);
        };
      }),
    );

    const first = service.runSweep();
    // Second tick fires while the first is still in flight.
    await expect(service.runSweep()).resolves.toBe(0);
    expect(deliveryService.redispatchUnassignedJobs).toHaveBeenCalledTimes(1);

    release();
    await expect(first).resolves.toBe(1);
  });

  it('survives a failing sweep so the timer keeps running', async () => {
    deliveryService.redispatchUnassignedJobs.mockRejectedValueOnce(new Error('database down'));
    await expect(service.runSweep()).resolves.toBe(0);

    // The guard was released, so the next tick still runs.
    deliveryService.redispatchUnassignedJobs.mockResolvedValueOnce(1);
    await expect(service.runSweep()).resolves.toBe(1);
  });
});
