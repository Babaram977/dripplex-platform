import { PricingService } from './pricing.service';

import type { PromotionsService } from '../promotions/promotions.service';

const customerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const merchantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('PricingService', () => {
  const promotions = {
    evaluateForCart: jest.fn(),
  } as unknown as jest.Mocked<PromotionsService>;

  const service = new PricingService(promotions);

  beforeEach(() => {
    jest.clearAllMocks();
    promotions.evaluateForCart.mockResolvedValue({
      subtotal: 5200,
      discountTotal: 0,
      discounts: [],
      couponCode: null,
      valid: false,
    });
  });

  it('computes real VAT and delivery fee for a DELIVERY order — the exact regression case that surfaced the original bug', async () => {
    const totals = await service.computeTotals({
      subtotal: 5200,
      customerId,
      merchantId,
      fulfillmentType: 'DELIVERY',
    });

    expect(totals).toEqual({
      subtotal: 5200,
      discount: 0,
      tax: 390,
      deliveryFee: 1500,
      total: 7090,
      couponCode: null,
    });
  });

  it('waives delivery fee for PICKUP', async () => {
    const totals = await service.computeTotals({
      subtotal: 5200,
      customerId,
      merchantId,
      fulfillmentType: 'PICKUP',
    });

    expect(totals.deliveryFee).toBe(0);
    expect(totals.total).toBe(5200 + 390);
  });

  it('defaults to a DELIVERY-shaped fee when fulfillmentType is omitted (Cart preview, chosen later at Checkout)', async () => {
    const totals = await service.computeTotals({ subtotal: 5200, customerId, merchantId });
    expect(totals.deliveryFee).toBe(1500);
  });

  it('applies a real, valid coupon discount and reduces tax accordingly', async () => {
    promotions.evaluateForCart.mockResolvedValue({
      subtotal: 5200,
      discountTotal: 500,
      discounts: [
        {
          promotionId: 'promo-1',
          code: 'SAVE500',
          name: 'Save 500',
          type: 'FIXED_AMOUNT',
          priority: 0,
          stackable: false,
          discountAmount: 500,
          creditAmount: 0,
        },
      ],
      couponCode: 'SAVE500',
      valid: true,
    });

    const totals = await service.computeTotals({
      subtotal: 5200,
      customerId,
      merchantId,
      fulfillmentType: 'DELIVERY',
      couponCode: 'SAVE500',
    });

    expect(totals.discount).toBe(500);
    expect(totals.couponCode).toBe('SAVE500');
    expect(totals.tax).toBe(roundMoney((5200 - 500) * 0.075));
    expect(totals.total).toBe(roundMoney(5200 - 500 + totals.tax + 1500));
    expect(promotions.evaluateForCart).toHaveBeenCalledWith({
      subtotal: 5200,
      userId: customerId,
      merchantId,
      couponCode: 'SAVE500',
    });
  });

  it('ignores an invalid coupon — no discount, no couponCode on the order, and no crash', async () => {
    promotions.evaluateForCart.mockResolvedValue({
      subtotal: 5200,
      discountTotal: 0,
      discounts: [],
      couponCode: 'GARBAGE',
      valid: false,
    });

    const totals = await service.computeTotals({
      subtotal: 5200,
      customerId,
      merchantId,
      fulfillmentType: 'DELIVERY',
      couponCode: 'GARBAGE',
    });

    expect(totals.discount).toBe(0);
    expect(totals.couponCode).toBeNull();
  });

  it('never lets discount exceed subtotal', async () => {
    promotions.evaluateForCart.mockResolvedValue({
      subtotal: 100,
      discountTotal: 9999,
      discounts: [],
      couponCode: 'HUGE',
      valid: true,
    });

    const totals = await service.computeTotals({
      subtotal: 100,
      customerId,
      merchantId,
      fulfillmentType: 'PICKUP',
    });

    expect(totals.discount).toBe(100);
    expect(totals.total).toBe(0);
  });
});

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
