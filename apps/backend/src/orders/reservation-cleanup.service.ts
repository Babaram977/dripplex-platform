import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CartStatus, OrderStatus, PaymentStatus } from '@prisma/client';

import { CART_REPOSITORY, type CartRepository } from '../cart/repositories/cart.repository';

import { InventoryReservationService } from './inventory/inventory-reservation.service';
import { RESERVATION_CLEANUP_INTERVAL_MS } from './order.constants';
import { ORDERS_REPOSITORY, type OrdersRepository } from './repositories/orders.repository';

/**
 * Releases expired inventory reservations, fails unpaid orders, and unlocks carts.
 * Runs every 5 minutes (no @nestjs/schedule dependency).
 */
@Injectable()
export class ReservationCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservationCleanupService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: OrdersRepository,
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepository,
    private readonly reservationService: InventoryReservationService,
  ) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runCleanup();
    }, RESERVATION_CLEANUP_INTERVAL_MS);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  public onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async runCleanup(): Promise<{
    failedOrders: number;
    releasedReservations: number;
    unlockedCarts: number;
  }> {
    if (this.running) {
      return { failedOrders: 0, releasedReservations: 0, unlockedCarts: 0 };
    }

    this.running = true;
    try {
      const now = new Date();
      const expiredOrders =
        await this.ordersRepository.findUnpaidOrdersWithExpiredReservations(now);

      let failedOrders = 0;
      let unlockedCarts = 0;

      for (const order of expiredOrders) {
        if (order.status === OrderStatus.PENDING && order.paymentStatus === PaymentStatus.PENDING) {
          await this.ordersRepository.transition(order.id, {
            status: OrderStatus.CANCELLED,
            paymentStatus: PaymentStatus.FAILED,
            cancelledAt: new Date(),
            cancelledBy: 'SYSTEM',
            cancellationReason: 'Payment window expired',
          });
          failedOrders += 1;
        }

        if (order.cartId) {
          const cart = await this.cartRepository.findById(order.cartId);
          if (cart?.status === CartStatus.LOCKED) {
            await this.cartRepository.updateStatus(order.cartId, CartStatus.ACTIVE);
            unlockedCarts += 1;
          }
        }
      }

      const releasedReservations = await this.reservationService.releaseExpired();

      if (failedOrders > 0 || releasedReservations > 0 || unlockedCarts > 0) {
        this.logger.log(
          `Reservation cleanup: failedOrders=${String(failedOrders)} released=${String(releasedReservations)} unlockedCarts=${String(unlockedCarts)}`,
        );
      }

      return { failedOrders, releasedReservations, unlockedCarts };
    } finally {
      this.running = false;
    }
  }
}
