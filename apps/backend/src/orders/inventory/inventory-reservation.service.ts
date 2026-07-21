import { Inject, Injectable, Logger } from '@nestjs/common';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import { ORDER_AUDIT_ACTIONS, RESERVATION_TTL_MS } from '../order.constants';
import {
  ORDERS_REPOSITORY,
  type CreateReservationInput,
  type OrdersRepository,
} from '../repositories/orders.repository';

@Injectable()
export class InventoryReservationService {
  private readonly logger = new Logger(InventoryReservationService.name);

  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: OrdersRepository,
    private readonly auditService: AuditService,
  ) {}

  public async reserve(input: {
    orderId: string;
    items: {
      productId: string;
      variantId?: string | null;
      quantity: number;
    }[];
    context?: AuditContext;
  }): Promise<void> {
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
    const rows: CreateReservationInput[] = input.items.map((item) => ({
      orderId: input.orderId,
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
      expiresAt,
    }));

    await this.ordersRepository.createReservations(rows);

    await this.auditService.record(ORDER_AUDIT_ACTIONS.INVENTORY_RESERVED, input.context ?? {}, {
      resource: 'order',
      resourceId: input.orderId,
      metadata: {
        itemCount: input.items.length,
        expiresAt: expiresAt.toISOString(),
        ttlMinutes: RESERVATION_TTL_MS / 60_000,
      },
    });
  }

  public async releaseForOrder(input: {
    orderId: string;
    context?: AuditContext;
    reason?: string;
  }): Promise<number> {
    const count = await this.ordersRepository.releaseReservationsForOrder(input.orderId);

    if (count > 0) {
      await this.auditService.record(ORDER_AUDIT_ACTIONS.INVENTORY_RELEASED, input.context ?? {}, {
        resource: 'order',
        resourceId: input.orderId,
        metadata: {
          releasedCount: count,
          reason: input.reason ?? 'manual',
        },
      });
    }

    return count;
  }

  public async releaseExpired(): Promise<number> {
    const expired = await this.ordersRepository.findExpiredActiveReservations(new Date());
    if (expired.length === 0) {
      return 0;
    }

    const orderIds = [...new Set(expired.map((row) => row.orderId))];
    let released = 0;
    for (const orderId of orderIds) {
      released += await this.releaseForOrder({
        orderId,
        reason: 'expired',
      });
    }

    this.logger.log(
      `Released ${String(released)} expired inventory reservation(s) across ${String(orderIds.length)} order(s)`,
    );
    return released;
  }
}
