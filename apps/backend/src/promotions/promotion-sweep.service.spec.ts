import { PromotionSweepService } from './promotion-sweep.service';

import type { PromotionsService } from './promotions.service';

describe('PromotionSweepService', () => {
  let promotionsService: jest.Mocked<PromotionsService>;
  let sweep: PromotionSweepService;

  beforeEach(() => {
    promotionsService = {
      activateDueCampaigns: jest.fn().mockResolvedValue(0),
      expireDueCampaigns: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<PromotionsService>;
    sweep = new PromotionSweepService(promotionsService);
  });

  afterEach(() => {
    sweep.onModuleDestroy();
  });

  it('activates and expires campaigns on each run', async () => {
    promotionsService.activateDueCampaigns.mockResolvedValue(1);
    promotionsService.expireDueCampaigns.mockResolvedValue(2);

    const result = await sweep.runSweep();

    expect(result).toEqual({ activated: 1, expired: 2 });
    expect(promotionsService.activateDueCampaigns).toHaveBeenCalledTimes(1);
    expect(promotionsService.expireDueCampaigns).toHaveBeenCalledTimes(1);
  });

  it('does not overlap concurrent sweeps', async () => {
    let resolveActivate: (() => void) | undefined;
    promotionsService.activateDueCampaigns.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveActivate = () => {
            resolve(0);
          };
        }),
    );

    const first = sweep.runSweep();
    const second = sweep.runSweep();

    expect(await second).toEqual({ activated: 0, expired: 0 });
    resolveActivate?.();
    await first;
  });

  it('starts and clears the interval timer on init/destroy', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    sweep.onModuleInit();
    expect(setIntervalSpy).toHaveBeenCalled();

    sweep.onModuleDestroy();
    expect(clearIntervalSpy).toHaveBeenCalled();

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });
});
