import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { POS_DRIVABLE_ORDER_STATUSES, type PosDrivableOrderStatus } from '../order-sync.constants';

/**
 * A POS reporting that it has moved an order along.
 *
 * The DrippleX order is named in the path, by order number. The POS's own
 * reference travels in the body because `OrderStatusUpdate.externalOrderId` is
 * NOT NULL and exists so the merchant can reconcile the two systems.
 */
export class UpdateOrderStatusDto {
  /**
   * The POS's own identifier for this order. Recorded, never used to resolve
   * anything: there is no external-order-id ↔ DrippleX-order mapping table, and
   * inventing a resolution rule from an opaque third-party string is how one
   * merchant's POS ends up moving another's order.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public readonly externalOrderId!: string;

  /**
   * The status the POS is reporting.
   *
   * Only `PREPARING` (accept) and `READY` are drivable from a POS. Everything
   * else in `OrderStatus` is DrippleX's — `CANCELLED` most of all, because
   * cancelling refunds the customer's wallet.
   */
  @IsIn(POS_DRIVABLE_ORDER_STATUSES)
  public readonly status!: PosDrivableOrderStatus;

  /**
   * When the POS made the change, by the POS's clock.
   *
   * Recorded as sent, never trusted as DrippleX's own ordering: two tills with
   * drifting clocks would otherwise reorder a merchant's history. Defaults to
   * the moment DrippleX received it.
   */
  @IsOptional()
  @IsISO8601()
  public readonly sourceTimestamp?: string;
}
