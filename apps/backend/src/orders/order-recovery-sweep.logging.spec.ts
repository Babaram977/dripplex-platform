import { type Logger } from '@nestjs/common';

import { OrderRecoverySweepService } from './order-recovery-sweep.service';

/**
 * DPX-ORDER-8D-RECOVERY — making the switched-off state legible.
 *
 * Founder ruling, 2026-09-16, after the recovery stack deployed: the safe state
 * produced no evidence of itself. An unactivated sweep returned early in
 * silence, so "the backstop is off" could only be inferred from an absence of
 * messages — indistinguishable from a sweep that ran and found nothing. The
 * deployment step "verify the system is inert" had nothing to verify against.
 *
 * No database here on purpose. These tests are about what an operator reads in
 * the logs, and nothing in that path touches Postgres.
 */
describe('OrderRecoverySweepService · activation announcement', () => {
  /** Activated, without setting the production constant. */
  class ActivatedSweep extends OrderRecoverySweepService {
    constructor(private readonly boundary: Date) {
      super({} as never);
    }
    protected override activationBoundary(): Date | null {
      return this.boundary;
    }
  }

  function capture(service: OrderRecoverySweepService): {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
  } {
    // The service's own logger instance, not the global one — asserting on a
    // different Logger would pass while the real line went nowhere.
    const logger = (service as unknown as { logger: Logger }).logger;
    return {
      log: jest.spyOn(logger, 'log').mockImplementation(() => undefined),
      warn: jest.spyOn(logger, 'warn').mockImplementation(() => undefined),
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('SWL-001 · unactivated: says so explicitly, and says the sweep will do nothing', () => {
    const service = new OrderRecoverySweepService({} as never);
    const { log, warn } = capture(service);

    service.onModuleInit();
    service.onModuleDestroy();

    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]?.[0]);

    // The three things an operator needs to be able to confirm from one line.
    expect(line).toMatch(/NOT activated/);
    expect(line).toMatch(/RECOVERY_ACTIVATION_AT/);
    expect(line).toMatch(/no order will be cancelled/i);
    expect(line).toMatch(/no money will move/i);

    // Not a warning: switched off is the expected, correct state.
    expect(warn).not.toHaveBeenCalled();
  });

  it('SWL-002 · activated: logs the boundary actually in force, to the instant', () => {
    const boundary = new Date('2026-10-01T09:30:00.000Z');
    const service = new ActivatedSweep(boundary);
    const { log, warn } = capture(service);

    service.onModuleInit();
    service.onModuleDestroy();

    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]?.[0]);

    // The exact instant, so the founder's "verify the exact activation
    // boundary" step can be satisfied from the logs rather than the database.
    expect(line).toContain('2026-10-01T09:30:00.000Z');
    expect(line).toMatch(/IS ACTIVATED/);
    // And what being activated actually means, spelled out.
    expect(line).toMatch(/cancel an order/i);
    expect(line).toMatch(/reverse a DX Wallet/i);

    expect(log).not.toHaveBeenCalled();
  });

  it('SWL-003 · the announcement describes the state the sweep will actually use', async () => {
    // THE LOAD-BEARING TEST. A line that resolved the constant independently
    // could report "not activated" while the sweep considered itself armed, or
    // the reverse — a log that lies about the safety state is worse than no log.
    // Both must come from the same seam, so overriding it moves both together.
    const service = new ActivatedSweep(new Date('2026-10-01T09:30:00.000Z'));
    const { warn } = capture(service);

    service.onModuleInit();
    service.onModuleDestroy();
    expect(warn).toHaveBeenCalledTimes(1);

    // The sweep agrees it is active. It reaches the repository and fails there
    // because this service was built with a stub — which is itself the proof it
    // did NOT take the inert early return.
    const result = await service.runSweep();
    expect(result.inactive).toBe(false);
  });

  it('SWL-004 · an unactivated sweep still performs no actions', async () => {
    // The behaviour this PR must not change. The announcement is additive; the
    // fail-closed early return is untouched.
    const recovery = { findBackstopEligible: jest.fn(), recoverAutomatically: jest.fn() };
    const service = new OrderRecoverySweepService(recovery as never);
    capture(service);

    const result = await service.runSweep();

    expect(result).toEqual({
      inactive: true,
      considered: 0,
      recovered: 0,
      skipped: 0,
      failed: 0,
    });
    // It returned before touching anything at all.
    expect(recovery.findBackstopEligible).not.toHaveBeenCalled();
    expect(recovery.recoverAutomatically).not.toHaveBeenCalled();
  });
});
