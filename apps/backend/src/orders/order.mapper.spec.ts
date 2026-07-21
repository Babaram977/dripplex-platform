import { generateOrderNumber, roundMoney, toOrderDto } from './order.mapper';

import type { OrderWithItems } from './repositories/orders.repository';
import type { FulfillmentType, OrderStatus, PaymentStatus } from '@prisma/client';

describe('order.mapper', () => {
  it('rounds money to 2 decimals', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(10.1)).toBe(10.1);
  });

  it('generates DPX order numbers', () => {
    expect(generateOrderNumber(new Date('2026-07-21T00:00:00.000Z'))).toMatch(
      /^DPX-20260721-[A-Z0-9]+$/,
    );
  });

  it('maps order snapshots to DTOs', () => {
    const order = {
      id: '11111111-1111-1111-1111-111111111111',
      customerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      merchantId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      cartId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      orderNumber: 'DPX-20260721-TEST',
      status: 'PENDING_PAYMENT' as OrderStatus,
      paymentStatus: 'PENDING' as PaymentStatus,
      fulfillmentType: 'DELIVERY' as FulfillmentType,
      subtotal: 5000,
      discount: 0,
      tax: 0,
      deliveryFee: 0,
      total: 5000,
      couponCode: null,
      deliveryAddressId: null,
      notes: null,
      currency: 'NGN',
      createdAt: new Date('2026-07-21T12:00:00.000Z'),
      updatedAt: new Date('2026-07-21T12:00:00.000Z'),
      items: [
        {
          id: '33333333-3333-3333-3333-333333333333',
          orderId: '11111111-1111-1111-1111-111111111111',
          productId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          variantId: null,
          merchantId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          quantity: 1,
          unitPrice: 5000,
          subtotal: 5000,
          snapshotName: 'Jollof',
          snapshotImage: null,
          snapshotSku: 'JR',
          createdAt: new Date('2026-07-21T12:00:00.000Z'),
        },
      ],
      reservations: [],
    } as unknown as OrderWithItems;

    const dto = toOrderDto(order);
    expect(dto.items[0]?.snapshotName).toBe('Jollof');
    expect(dto.total).toBe(5000);
    expect(dto.createdAt).toBe('2026-07-21T12:00:00.000Z');
  });
});
