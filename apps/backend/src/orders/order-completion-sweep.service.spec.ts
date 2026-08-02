import { OrderStatus } from '@prisma/client';

import { DOMAIN_EVENTS } from '../events/domain-events';

import { OrderCompletionSweepService } from './order-completion-sweep.service';

import type { DomainEventBus } from '../events/domain-event-bus';
import type { OrdersRepository, OrderWithItems } from './repositories/orders.repository';

const orderId = '11111111-1111-1111-1111-111111111111';
const customerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const merchantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeOrder(overrides: Partial<OrderWithItems> = {}): OrderWithItems {
  return {
    id: orderId,
    customerId,
    merchantId,
    status: OrderStatus.DELIVERED,
    items: [],
    ...overrides,
  } as unknown as OrderWithItems;
}

describe('OrderCompletionSweepService', () => {
  const ordersRepository: jest.Mocked<OrdersRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdForCustomer: jest.fn(),
    findByIdForMerchant: jest.fn(),
    list: jest.fn(),
    transition: jest.fn(),
    findByCartId: jest.fn(),
    createReservations: jest.fn(),
    releaseReservationsForOrder: jest.fn(),
    findExpiredActiveReservations: jest.fn(),
    findUnpaidOrdersWithExpiredReservations: jest.fn(),
    findAutoCompletableOrders: jest.fn(),
    createDispute: jest.fn(),
    findDisputeById: jest.fn(),
    findOpenDisputeForOrder: jest.fn(),
    resolveDispute: jest.fn(),
  };

  const eventBus = {
    emit: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<DomainEventBus>;

  const service = new OrderCompletionSweepService(ordersRepository, eventBus);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes eligible delivered orders and emits ORDER_COMPLETED', async () => {
    ordersRepository.findAutoCompletableOrders.mockResolvedValue([makeOrder()]);
    ordersRepository.transition.mockResolvedValue(makeOrder({ status: OrderStatus.COMPLETED }));

    const result = await service.runSweep();

    expect(result.completedOrders).toBe(1);
    expect(ordersRepository.transition).toHaveBeenCalledWith(orderId, {
      status: OrderStatus.COMPLETED,
      completedAt: expect.any(Date),
    });
    expect(eventBus.emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.ORDER_COMPLETED,
      expect.objectContaining({ orderId, customerId, merchantId }),
      expect.any(Object),
    );
  });

  it('does nothing when no orders are eligible', async () => {
    ordersRepository.findAutoCompletableOrders.mockResolvedValue([]);

    const result = await service.runSweep();

    expect(result.completedOrders).toBe(0);
    expect(ordersRepository.transition).not.toHaveBeenCalled();
  });

  it('is reentrant-safe: a concurrent call while running returns immediately', async () => {
    let resolveFindAutoCompletable: (value: OrderWithItems[]) => void = () => undefined;
    ordersRepository.findAutoCompletableOrders.mockReturnValue(
      new Promise((resolve) => {
        resolveFindAutoCompletable = resolve;
      }),
    );

    const firstRun = service.runSweep();
    const secondRun = await service.runSweep();

    expect(secondRun.completedOrders).toBe(0);
    resolveFindAutoCompletable([]);
    await firstRun;
  });
});
