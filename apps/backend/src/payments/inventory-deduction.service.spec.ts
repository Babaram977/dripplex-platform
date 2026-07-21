import { ReservationBackedInventoryDeductionService } from './inventory-deduction.service';
import { PAYMENT_AUDIT_ACTIONS } from './payment.constants';

import type { AuditService } from '../audit/audit.service';
import type { OrdersRepository, OrderWithItems } from '../orders/repositories/orders.repository';

describe('ReservationBackedInventoryDeductionService', () => {
  const ordersRepository = {
    findById: jest.fn(),
    releaseReservationsForOrder: jest.fn().mockResolvedValue(2),
  } as unknown as jest.Mocked<OrdersRepository>;

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const service = new ReservationBackedInventoryDeductionService(ordersRepository, auditService);

  it('releases reservations and audits deduction', async () => {
    ordersRepository.findById.mockResolvedValue({
      id: 'order-1',
      reservations: [
        {
          id: 'r1',
          productId: 'p1',
          variantId: null,
          quantity: 1,
          releasedAt: null,
        },
        {
          id: 'r2',
          productId: 'p2',
          variantId: null,
          quantity: 2,
          releasedAt: null,
        },
      ],
    } as unknown as OrderWithItems);

    const result = await service.deductForOrder({ orderId: 'order-1' });
    expect(result.deducted).toBe(2);
    expect(ordersRepository.releaseReservationsForOrder).toHaveBeenCalledWith('order-1');
    expect(auditService.record).toHaveBeenCalledWith(
      PAYMENT_AUDIT_ACTIONS.INVENTORY_DEDUCTED,
      expect.any(Object),
      expect.any(Object),
    );
  });
});
