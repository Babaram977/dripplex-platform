import { Inject, Injectable } from '@nestjs/common';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { ORDERS_REPOSITORY, type OrdersRepository } from '../orders/repositories/orders.repository';

import { PAYMENT_AUDIT_ACTIONS } from './payment.constants';

/**
 * Deducts reserved inventory after successful payment.
 * Catalog stock ledgers will replace the stub recording path.
 */
export abstract class InventoryDeductionService {
  public abstract deductForOrder(input: {
    orderId: string;
    context?: AuditContext;
  }): Promise<{ deducted: number }>;
}

@Injectable()
export class ReservationBackedInventoryDeductionService extends InventoryDeductionService {
  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: OrdersRepository,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  public async deductForOrder(input: {
    orderId: string;
    context?: AuditContext;
  }): Promise<{ deducted: number }> {
    const order = await this.ordersRepository.findById(input.orderId);
    const activeReservations = (order?.reservations ?? []).filter((row) => row.releasedAt === null);

    // Stock ledger deduction happens here once product inventory exists.
    // For S1-C12 we finalize the reservation hold (consume + release).
    const released = await this.ordersRepository.releaseReservationsForOrder(input.orderId);

    await this.auditService.record(PAYMENT_AUDIT_ACTIONS.INVENTORY_DEDUCTED, input.context ?? {}, {
      resource: 'order',
      resourceId: input.orderId,
      metadata: {
        reservationCount: activeReservations.length,
        releasedCount: released,
        items: activeReservations.map((row) => ({
          productId: row.productId,
          variantId: row.variantId,
          quantity: row.quantity,
        })),
      },
    });

    return { deducted: activeReservations.length > 0 ? activeReservations.length : released };
  }
}

export const INVENTORY_DEDUCTION_SERVICE = Symbol('INVENTORY_DEDUCTION_SERVICE');
