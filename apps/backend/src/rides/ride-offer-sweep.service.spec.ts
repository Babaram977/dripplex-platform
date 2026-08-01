import { RideOfferSweepService } from './ride-offer-sweep.service';

import type { RideDispatchService } from './ride-dispatch.service';

describe('RideOfferSweepService', () => {
  it('delegates to RideDispatchService.expireStaleOffers', async () => {
    const dispatchService = {
      expireStaleOffers: jest.fn().mockResolvedValue(2),
    } as unknown as jest.Mocked<RideDispatchService>;
    const service = new RideOfferSweepService(dispatchService);

    const result = await service.runSweep();

    expect(result).toBe(2);
    expect(dispatchService.expireStaleOffers).toHaveBeenCalledTimes(1);
  });

  it('does not re-enter while a sweep is already running', async () => {
    let resolveFirst!: (value: number) => void;
    const dispatchService = {
      expireStaleOffers: jest.fn().mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            resolveFirst = resolve;
          }),
      ),
    } as unknown as jest.Mocked<RideDispatchService>;
    const service = new RideOfferSweepService(dispatchService);

    const firstRun = service.runSweep();
    const secondRun = await service.runSweep();

    expect(secondRun).toBe(0);
    expect(dispatchService.expireStaleOffers).toHaveBeenCalledTimes(1);

    resolveFirst(1);
    await expect(firstRun).resolves.toBe(1);
  });

  it('starts and clears an interval timer on module init/destroy', () => {
    jest.useFakeTimers();
    const setSpy = jest.spyOn(global, 'setInterval');
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const dispatchService = {
      expireStaleOffers: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<RideDispatchService>;
    const service = new RideOfferSweepService(dispatchService);

    service.onModuleInit();
    expect(setSpy).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
    expect(clearSpy).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
