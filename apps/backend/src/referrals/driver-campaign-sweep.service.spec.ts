import { DriverCampaignSweepService } from './driver-campaign-sweep.service';

import type { DriverCampaignService } from './driver-campaign.service';

describe('DriverCampaignSweepService', () => {
  let driverCampaignService: jest.Mocked<DriverCampaignService>;
  let sweep: DriverCampaignSweepService;

  beforeEach(() => {
    driverCampaignService = {
      activateDueCampaigns: jest.fn().mockResolvedValue(0),
      endExpiredCampaigns: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<DriverCampaignService>;
    sweep = new DriverCampaignSweepService(driverCampaignService);
  });

  afterEach(() => {
    sweep.onModuleDestroy();
  });

  it('activates and ends campaigns on each run', async () => {
    driverCampaignService.activateDueCampaigns.mockResolvedValue(1);
    driverCampaignService.endExpiredCampaigns.mockResolvedValue(2);

    const result = await sweep.runSweep();

    expect(result).toEqual({ activated: 1, ended: 2 });
    expect(driverCampaignService.activateDueCampaigns).toHaveBeenCalledTimes(1);
    expect(driverCampaignService.endExpiredCampaigns).toHaveBeenCalledTimes(1);
  });

  it('does not overlap concurrent sweeps', async () => {
    let resolveActivate: (() => void) | undefined;
    driverCampaignService.activateDueCampaigns.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveActivate = () => {
            resolve(0);
          };
        }),
    );

    const first = sweep.runSweep();
    const second = sweep.runSweep();

    expect(await second).toEqual({ activated: 0, ended: 0 });
    resolveActivate?.();
    await first;
  });
});
