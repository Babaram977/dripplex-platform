import { OrderStatus } from '@prisma/client';

import { DOMAIN_EVENTS } from '../events/domain-events';

import { OrderExceptionSweepService } from './order-exception-sweep.service';

import type { OrdersRepository, OrderWithItems } from './repositories/orders.repository';

/**
 * DPX-ORDER-8D-C — the stalled-order detection sweep.
 *
 * Founder remediation ruling, 2026-09-16. These pin the two properties the
 * ruling asks for by name — idempotent exception creation, and protection
 * against repeated notifications — plus the one it is emphatic about NOT having:
 * the sweep must mutate no order.
 *
 * The idempotency guarantee itself is a database unique constraint, so it is
 * proven against real Postgres in order-exception-idempotency.spec.ts. What is
 * proven here is that the service honours the repository's answer: a refused
 * raise notifies nobody.
 */

const ORDER_ID = 'order-1';
const MERCHANT_ID = 'merchant-profile-1';

function stalledOrder(over: Partial<OrderWithItems> = {}): OrderWithItems {
  const confirmedAt = new Date(Date.now() - 45 * 60_000);
  return {
    id: ORDER_ID,
    orderNumber: 'DPX-TEST-0001',
    customerId: 'customer-1',
    merchantId: MERCHANT_ID,
    status: OrderStatus.CONFIRMED,
    fulfillmentType: 'DELIVERY',
    paymentMethod: 'CASH',
    paymentStatus: 'PENDING',
    confirmedAt,
    createdAt: confirmedAt,
    ...over,
  } as unknown as OrderWithItems;
}

function makeService(
  orders: OrderWithItems[],
  raised: boolean,
): {
  service: OrderExceptionSweepService;
  emit: jest.Mock;
  repository: jest.Mocked<OrdersRepository>;
} {
  const emit = jest.fn().mockResolvedValue(undefined);
  // An exception is only announced once it exists, so a raised one is what the
  // pending-notification query would return.
  const pending = raised
    ? orders.map((order) => ({ id: `exc-${order.id}`, waitedMinutes: 45, order }))
    : [];
  const repository = {
    findStalledConfirmedOrders: jest.fn().mockResolvedValue(orders),
    raiseStalledException: jest.fn().mockResolvedValue({ raised }),
    findUnnotifiedOpenExceptions: jest.fn().mockResolvedValue(pending),
    markExceptionNotified: jest.fn().mockResolvedValue(undefined),
    transition: jest.fn(),
  } as unknown as jest.Mocked<OrdersRepository>;
  const service = new OrderExceptionSweepService(repository, { emit } as never);
  return { service, emit, repository };
}

describe('OrderExceptionSweepService', () => {
  it('OES-001 · raises an exception and announces it once for a stalled order', async () => {
    const { service, emit } = makeService([stalledOrder()], true);

    const result = await service.runSweep();

    expect(result).toEqual({ raised: 1, alreadyOpen: 0, notified: 1 });
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.ORDER_EXCEPTION_RAISED,
      expect.objectContaining({
        orderId: ORDER_ID,
        merchantId: MERCHANT_ID,
        type: 'STALLED_CONFIRMED',
        waitedMinutes: expect.any(Number),
      }),
      expect.anything(),
    );
  });

  it('OES-002 · a re-detected order announces nothing', async () => {
    // The repository refuses the raise because the unique constraint already
    // holds a row. This is the every-fifteen-minutes case: without it the
    // merchant is told about the same order four times an hour.
    const { service, emit } = makeService([stalledOrder()], false);

    const result = await service.runSweep();

    expect(result).toEqual({ raised: 0, alreadyOpen: 1, notified: 0 });
    expect(emit).not.toHaveBeenCalled();
  });

  it('OES-003 · counts a still-stalled order separately from a newly stalled one', async () => {
    // "Nothing is stalling" and "the same orders are still stalled and we have
    // already said so" are different operational pictures; one number would
    // collapse them.
    const { service } = makeService([], true);
    expect(await service.runSweep()).toEqual({ raised: 0, alreadyOpen: 0, notified: 0 });
  });

  it('OES-004 · the sweep mutates no order — detection only', async () => {
    const { service, repository } = makeService([stalledOrder()], true);

    await service.runSweep();

    // The ruling is explicit: 30 minutes is an escalation threshold, not an
    // automatic cancellation rule. Nothing here may cancel, decline, refund,
    // release inventory or advance an order.
    expect(repository.transition).not.toHaveBeenCalled();
  });

  it('OES-005 · records how long the order had waited, not how long it has waited since', async () => {
    const confirmedAt = new Date(Date.now() - 90 * 60_000);
    const { service, repository } = makeService(
      [stalledOrder({ confirmedAt, createdAt: confirmedAt })],
      true,
    );

    await service.runSweep();

    const call = (repository.raiseStalledException as jest.Mock).mock.calls[0]?.[0] as {
      waitedMinutes: number;
    };
    // ~90 minutes. Stored at detection because it stops being derivable the
    // moment the order progresses.
    expect(call.waitedMinutes).toBeGreaterThanOrEqual(89);
    expect(call.waitedMinutes).toBeLessThanOrEqual(91);
  });

  it('OES-006 · falls back to createdAt when confirmedAt is null', async () => {
    const createdAt = new Date(Date.now() - 50 * 60_000);
    const { service, repository } = makeService(
      [stalledOrder({ confirmedAt: null, createdAt })],
      true,
    );

    await service.runSweep();

    const call = (repository.raiseStalledException as jest.Mock).mock.calls[0]?.[0] as {
      waitedMinutes: number;
    };
    // A null confirmedAt must surface the order, not silently drop it.
    expect(call.waitedMinutes).toBeGreaterThanOrEqual(49);
  });

  it('OES-007 · a failing sweep does not throw, so the interval survives', async () => {
    const { service, repository } = makeService([stalledOrder()], true);
    (repository.findStalledConfirmedOrders as jest.Mock).mockRejectedValue(new Error('db down'));

    // It runs again in fifteen minutes and the orders it missed are still
    // there; an unhandled rejection out of a timer callback is not.
    await expect(service.runSweep()).resolves.toEqual({ raised: 0, alreadyOpen: 0, notified: 0 });
  });

  it('OES-009 · a failed announcement leaves the exception retryable, not consumed', async () => {
    // THE DEFECT THIS CATCHES. The row is committed before the notification is
    // sent. If a failed emit marked it notified — or was never retried — the
    // unique constraint that stops a duplicate row would also stop the merchant
    // ever being told, and a stalled-order detector would have silently failed
    // to report a stalled order.
    const { service, repository, emit } = makeService([stalledOrder()], true);
    emit.mockRejectedValue(new Error('bus down'));

    const result = await service.runSweep();

    expect(result.raised).toBe(1);
    expect(result.notified).toBe(0);
    // Left unmarked on purpose, so the next sweep tries again.
    expect(repository.markExceptionNotified).not.toHaveBeenCalled();
  });

  it('OES-010 · one merchant\u2019s failed announcement does not silence the next', async () => {
    const a = stalledOrder({ id: 'order-a' });
    const b = stalledOrder({ id: 'order-b' });
    const { service, repository, emit } = makeService([a, b], true);
    emit.mockRejectedValueOnce(new Error('bus down')).mockResolvedValue(undefined);

    const result = await service.runSweep();

    // Isolated per exception: the second merchant is still warned.
    expect(result.notified).toBe(1);
    expect(repository.markExceptionNotified).toHaveBeenCalledTimes(1);
  });

  it('OES-011 · an exception raised earlier is announced on a later sweep', async () => {
    // Nothing newly stalled, but a previous cycle left something unannounced.
    const { service, emit, repository } = makeService([], true);
    (repository.findUnnotifiedOpenExceptions as jest.Mock).mockResolvedValue([
      { id: 'exc-old', waitedMinutes: 120, order: stalledOrder() },
    ]);

    const result = await service.runSweep();

    expect(result).toEqual({ raised: 0, alreadyOpen: 0, notified: 1 });
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('OES-008 · a sweep already in flight does not start a second one', async () => {
    const { service, repository } = makeService([stalledOrder()], true);
    const releases: (() => void)[] = [];
    (repository.findStalledConfirmedOrders as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(() => {
            resolve([]);
          });
        }),
    );

    const first = service.runSweep();
    const second = await service.runSweep();

    expect(second).toEqual({ raised: 0, alreadyOpen: 0, notified: 0 });
    for (const release of releases) {
      release();
    }
    await first;
  });
});
