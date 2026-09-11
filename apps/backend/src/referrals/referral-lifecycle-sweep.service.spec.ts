import { ReferralLifecycleSweepService } from './referral-lifecycle-sweep.service';

import type { ReferralLifecycleService } from './referral-lifecycle.service';

describe('ReferralLifecycleSweepService', () => {
  let lifecycle: jest.Mocked<ReferralLifecycleService>;
  let sweep: ReferralLifecycleSweepService;

  beforeEach(() => {
    lifecycle = {
      sweep: jest.fn().mockResolvedValue({ qualified: 0, paid: 0, expired: 0 }),
    } as unknown as jest.Mocked<ReferralLifecycleService>;
    sweep = new ReferralLifecycleSweepService(lifecycle);
  });

  afterEach(() => {
    sweep.onModuleDestroy();
  });

  it('reports what the pass moved', async () => {
    lifecycle.sweep.mockResolvedValue({ qualified: 3, paid: 2, expired: 1 });

    expect(await sweep.runSweep()).toEqual({ qualified: 3, paid: 2, expired: 1 });
  });

  it('does not overlap concurrent sweeps', async () => {
    // A pass that pays can outlast the interval. Two passes over the same
    // redemptions would not double-pay — the wallet credits are keyed on the
    // redemption id — but they would compete for the same rows for nothing.
    let release: (() => void) | undefined;
    lifecycle.sweep.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => {
            resolve({ qualified: 0, paid: 0, expired: 0 });
          };
        }),
    );

    const first = sweep.runSweep();
    const second = sweep.runSweep();

    expect(await second).toEqual({ qualified: 0, paid: 0, expired: 0 });
    expect(lifecycle.sweep).toHaveBeenCalledTimes(1);
    release?.();
    await first;
  });

  it('survives a failing pass, so the next one still runs', async () => {
    // A sweep that throws must not take the interval with it and leave the
    // referral programme silently switched off for the lifetime of the process.
    lifecycle.sweep.mockRejectedValueOnce(new Error('database unavailable'));

    expect(await sweep.runSweep()).toEqual({ qualified: 0, paid: 0, expired: 0 });

    lifecycle.sweep.mockResolvedValue({ qualified: 1, paid: 0, expired: 0 });
    expect(await sweep.runSweep()).toEqual({ qualified: 1, paid: 0, expired: 0 });
  });
});
