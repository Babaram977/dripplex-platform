import { ORDER_AUDIT_ACTIONS } from '../order.constants';

import { InventoryReservationService } from './inventory-reservation.service';

import type { AuditService } from '../../audit/audit.service';
import type { OrdersRepository } from '../repositories/orders.repository';

describe('InventoryReservationService', () => {
  const ordersRepository = {
    createReservations: jest.fn().mockResolvedValue([]),
    releaseReservationsForOrder: jest.fn().mockResolvedValue(2),
    findExpiredActiveReservations: jest
      .fn()
      .mockResolvedValue([{ orderId: 'order-1' }, { orderId: 'order-1' }, { orderId: 'order-2' }]),
  } as unknown as jest.Mocked<OrdersRepository>;

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const service = new InventoryReservationService(ordersRepository, auditService);

  beforeEach(() => {
    jest.clearAllMocks();
    ordersRepository.createReservations = jest.fn().mockResolvedValue([]);
    ordersRepository.releaseReservationsForOrder = jest.fn().mockResolvedValue(2);
    ordersRepository.findExpiredActiveReservations = jest
      .fn()
      .mockResolvedValue([{ orderId: 'order-1' }, { orderId: 'order-1' }, { orderId: 'order-2' }]);
  });

  it('creates reservations with audit', async () => {
    await service.reserve({
      orderId: 'order-1',
      items: [{ productId: 'p1', quantity: 1 }],
      context: { userId: 'u1' },
    });

    expect(ordersRepository.createReservations).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      ORDER_AUDIT_ACTIONS.INVENTORY_RESERVED,
      expect.any(Object),
      expect.objectContaining({ resourceId: 'order-1' }),
    );
  });

  it('releases reservations with audit', async () => {
    const count = await service.releaseForOrder({
      orderId: 'order-1',
      reason: 'cancel',
    });
    expect(count).toBe(2);
    expect(auditService.record).toHaveBeenCalledWith(
      ORDER_AUDIT_ACTIONS.INVENTORY_RELEASED,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('releases expired reservations per unique order', async () => {
    const count = await service.releaseExpired();
    expect(count).toBe(4);
    expect(ordersRepository.releaseReservationsForOrder).toHaveBeenCalledTimes(2);
  });
});
