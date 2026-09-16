import { DOMAIN_EVENTS } from '../events/domain-events';
import { MerchantOrderNotificationSubscriber } from '../notification-center/merchant-order-notification.subscriber';
import { NotificationCenterSubscriber } from '../notification-center/notification-center.subscriber';

import type { DomainEvent } from '../events/domain-events';
import type { NotificationCenterService } from '../notification-center/notification-center.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The boundary that actually failed: confirmation → event → subscriber →
 * the merchant's inbox.
 *
 * `merchant-order-notification.subscriber.spec.ts` tested the subscriber in
 * ISOLATION — "on a new paid order, notify the merchant" — and passed for the
 * entire pilot while no cash order ever produced that event. The unit was
 * correct; the wiring was not. A test that stubs the event it is supposed to
 * prove gets emitted cannot catch that, which is the whole reason this file
 * exists alongside it.
 *
 * So these tests drive the REAL event bus and the REAL subscribers, and assert
 * on what lands in the merchant's inbox. The only thing stubbed is Prisma and
 * the notification sink — the edges, not the mechanism.
 *
 * Founder ruling, 2026-09-15:
 *   ORDER_ACTIONABLE — the merchant needs to act on this order. Every payment
 *                      method, emitted from the single confirmation chokepoint.
 *   ORDER_PAID       — money has actually been received. Nothing else.
 */

/** A minimal synchronous event bus with the shape the subscribers consume. */
class TestEventBus {
  private readonly handlers = new Map<string, ((event: DomainEvent) => unknown)[]>();

  public on(name: string, handler: (event: DomainEvent) => unknown): void {
    const existing = this.handlers.get(name) ?? [];
    existing.push(handler);
    this.handlers.set(name, existing);
  }

  public async emit(name: string, payload: Record<string, unknown>): Promise<void> {
    for (const handler of this.handlers.get(name) ?? []) {
      await handler({ name, payload, occurredAt: new Date().toISOString() });
    }
  }
}

const MERCHANT_PROFILE_ID = 'merchant-profile-1';
const MERCHANT_USER_ID = 'merchant-user-1';
const CUSTOMER_ID = 'customer-1';

interface Harness {
  bus: TestEventBus;
  sent: { userId: string; type: string; title: string }[];
}

function harness(): Harness {
  const sent: { userId: string; type: string; title: string }[] = [];

  const notificationCenter = {
    send: (input: { userId: string; type: string; title: string }): Promise<unknown> => {
      sent.push({ userId: input.userId, type: input.type, title: input.title });
      return Promise.resolve({ notification: null, skipped: false });
    },
  } as unknown as NotificationCenterService;

  const prisma = {
    merchantProfile: {
      findUnique: () => Promise.resolve({ userId: MERCHANT_USER_ID }),
    },
  } as unknown as PrismaService;

  const bus = new TestEventBus();

  // Both real subscribers, wired exactly as the module wires them.
  new MerchantOrderNotificationSubscriber(bus as never, notificationCenter, prisma).onModuleInit();

  return { bus, sent };
}

/** What `finalizeOrderConfirmation` emits, for each payment method. */
const confirmation = (paymentMethod: string, paymentStatus: string): Record<string, unknown> => ({
  orderId: 'order-1',
  orderNumber: 'DPX-TEST-0001',
  customerId: CUSTOMER_ID,
  merchantId: MERCHANT_PROFILE_ID,
  fulfillmentType: 'DELIVERY',
  paymentMethod,
  paymentStatus,
  amount: 3650,
  currency: 'NGN',
});

const merchantNotifications = (h: Harness): { userId: string; type: string; title: string }[] =>
  h.sent.filter((n) => n.userId === MERCHANT_USER_ID);

describe('ORDER_ACTIONABLE — confirmation reaches the merchant, whatever the payment method', () => {
  it('OA-001 · CASH confirmation notifies the merchant', async () => {
    const h = harness();
    // Cash confirms with payment still PENDING — the exact case that silently
    // notified nobody and left a real order stationary for four days.
    await h.bus.emit(DOMAIN_EVENTS.ORDER_ACTIONABLE, confirmation('CASH', 'PENDING'));

    expect(merchantNotifications(h)).toEqual([
      { userId: MERCHANT_USER_ID, type: 'ORDER_PLACED', title: 'New order received' },
    ]);
  });

  it('OA-002 · MERCHANT_DIRECT confirmation notifies the merchant', async () => {
    const h = harness();
    // Bank transfer paid to the merchant: paymentStatus stays PENDING for the
    // order's whole life, so it can never be reached via a payment event.
    await h.bus.emit(DOMAIN_EVENTS.ORDER_ACTIONABLE, confirmation('MERCHANT_DIRECT', 'PENDING'));

    expect(merchantNotifications(h)).toHaveLength(1);
  });

  it('OA-003 · gateway confirmation notifies the merchant exactly once', async () => {
    const h = harness();
    // The gateway path emits BOTH events. If the subscriber had been left on
    // ORDER_PAID as well as moved to ORDER_ACTIONABLE, this would be 2.
    await h.bus.emit(DOMAIN_EVENTS.ORDER_ACTIONABLE, confirmation('CARD', 'PAID'));
    await h.bus.emit(DOMAIN_EVENTS.ORDER_PAID, confirmation('CARD', 'PAID'));

    expect(merchantNotifications(h)).toHaveLength(1);
  });

  it('OA-004 · wallet confirmation notifies the merchant exactly once', async () => {
    const h = harness();
    await h.bus.emit(DOMAIN_EVENTS.ORDER_ACTIONABLE, confirmation('WALLET', 'PAID'));
    await h.bus.emit(DOMAIN_EVENTS.ORDER_PAID, confirmation('WALLET', 'PAID'));

    expect(merchantNotifications(h)).toHaveLength(1);
  });

  it('OA-005 · ORDER_PAID alone never notifies the merchant', async () => {
    const h = harness();
    // This is the assertion that pins the ruling. Cash collection at the door
    // legitimately emits ORDER_PAID hours after the merchant already acted;
    // if that still notified them, every cash order would produce a spurious
    // "New order received" after it had been delivered.
    await h.bus.emit(DOMAIN_EVENTS.ORDER_PAID, confirmation('CASH', 'PAID'));

    expect(merchantNotifications(h)).toHaveLength(0);
  });

  it('OA-006 · a cash order notified once at confirmation is not notified again at collection', async () => {
    const h = harness();
    await h.bus.emit(DOMAIN_EVENTS.ORDER_ACTIONABLE, confirmation('CASH', 'PENDING'));
    // …the rider later collects the cash.
    await h.bus.emit(DOMAIN_EVENTS.ORDER_PAID, confirmation('CASH', 'PAID'));

    expect(merchantNotifications(h)).toHaveLength(1);
  });
});

describe('ORDER_ACTIONABLE is not a payment event', () => {
  it('OA-007 · the generic notification mapper ignores it, so no customer is told anything', async () => {
    const sent: { userId: string; type: string }[] = [];
    const notificationCenter = {
      send: (input: { userId: string; type: string }): Promise<unknown> => {
        sent.push({ userId: input.userId, type: input.type });
        return Promise.resolve({ notification: null, skipped: false });
      },
    } as unknown as NotificationCenterService;

    const bus = new TestEventBus();
    const generic = new NotificationCenterSubscriber(bus as never, notificationCenter);
    generic.onModuleInit();

    await bus.emit(DOMAIN_EVENTS.ORDER_ACTIONABLE, confirmation('CASH', 'PENDING'));

    // ORDER_ACTIONABLE carries a customerId, so an accidental mapping would
    // quietly tell the customer something. It has none, and must not acquire
    // one: the customer already learns of their own order at checkout.
    expect(sent).toHaveLength(0);
  });

  it('OA-008 · no subscriber reads it as proof of payment', async () => {
    const h = harness();
    await h.bus.emit(DOMAIN_EVENTS.ORDER_ACTIONABLE, confirmation('CASH', 'PENDING'));

    // The merchant is told an order arrived — never that it was paid for.
    // Loyalty (50 DX Points), paid-revenue analytics and the customer's
    // "payment received" message all hang off ORDER_PAID, and an unpaid cash
    // order must reach none of them.
    for (const notification of h.sent) {
      expect(notification.type).not.toBe('PAYMENT_SUCCESS');
      expect(notification.title.toLowerCase()).not.toContain('paid');
      expect(notification.title.toLowerCase()).not.toContain('payment');
    }
  });
});
