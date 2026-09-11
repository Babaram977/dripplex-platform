import { LoyaltyExpirySweepService } from './loyalty-expiry-sweep.service';
import { LOYALTY_EXPIRY_SWEEP_INTERVAL_MS } from './loyalty.constants';

import type { LoyaltyService } from './loyalty.service';

describe('LoyaltyExpirySweepService', () => {
  let loyaltyService: { expirePoints: jest.Mock };
  let sweep: LoyaltyExpirySweepService;

  beforeEach(() => {
    loyaltyService = { expirePoints: jest.fn().mockResolvedValue({ expiredPoints: 0 }) };
    sweep = new LoyaltyExpirySweepService(loyaltyService as unknown as LoyaltyService);
  });

  afterEach(() => {
    sweep.onModuleDestroy();
  });

  it('runs the expiry that nothing used to call', async () => {
    loyaltyService.expirePoints.mockResolvedValue({ expiredPoints: 750 });

    await expect(sweep.runSweep()).resolves.toEqual({ expiredPoints: 750 });
    expect(loyaltyService.expirePoints).toHaveBeenCalledTimes(1);
  });

  it('does not start a second sweep while one is still running', async () => {
    let release: () => void = () => undefined;
    loyaltyService.expirePoints.mockReturnValue(
      new Promise((resolve) => {
        release = (): void => {
          resolve({ expiredPoints: 10 });
        };
      }),
    );

    const first = sweep.runSweep();
    // Overlapping sweeps would both see the same due awards and expire them
    // twice; the second must simply decline.
    await expect(sweep.runSweep()).resolves.toEqual({ expiredPoints: 0 });
    release();
    await first;

    expect(loyaltyService.expirePoints).toHaveBeenCalledTimes(1);
  });

  it('survives a failing sweep so the next hour still runs', async () => {
    loyaltyService.expirePoints.mockRejectedValueOnce(new Error('database is down'));

    await expect(sweep.runSweep()).resolves.toEqual({ expiredPoints: 0 });

    loyaltyService.expirePoints.mockResolvedValue({ expiredPoints: 5 });
    await expect(sweep.runSweep()).resolves.toEqual({ expiredPoints: 5 });
  });

  it('schedules itself hourly without holding the process open', () => {
    const unref = jest.fn();
    const spy = jest
      .spyOn(global, 'setInterval')
      .mockReturnValue({ unref } as unknown as ReturnType<typeof setInterval>);

    sweep.onModuleInit();

    expect(spy).toHaveBeenCalledWith(expect.any(Function), LOYALTY_EXPIRY_SWEEP_INTERVAL_MS);
    // An interval that keeps the event loop alive stops the container shutting
    // down cleanly on deploy.
    expect(unref).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('sweeps when the interval fires', () => {
    let tick: (() => void) | undefined;
    const spy = jest.spyOn(global, 'setInterval').mockImplementation((callback: () => void) => {
      tick = callback;
      return { unref: jest.fn() } as unknown as ReturnType<typeof setInterval>;
    });

    sweep.onModuleInit();
    tick?.();

    expect(loyaltyService.expirePoints).toHaveBeenCalled();
    spy.mockRestore();
  });
});
