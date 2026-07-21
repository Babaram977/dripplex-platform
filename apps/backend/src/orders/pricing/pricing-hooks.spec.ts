import { ZeroCouponCalculator } from './coupon-calculator';
import { ZeroDeliveryCalculator } from './delivery-calculator';
import { ZeroTaxCalculator } from './tax-calculator';

describe('checkout pricing hooks', () => {
  it('defaults tax to zero', () => {
    expect(new ZeroTaxCalculator().calculate()).toBe(0);
  });

  it('defaults delivery fee to zero', () => {
    expect(new ZeroDeliveryCalculator().calculate()).toBe(0);
  });

  it('defaults coupon discount to zero while preserving code', () => {
    expect(
      new ZeroCouponCalculator().calculate({
        subtotal: 5000,
        couponCode: 'SAVE10',
        currency: 'NGN',
      }),
    ).toEqual({ discount: 0, couponCode: 'SAVE10' });
  });
});
