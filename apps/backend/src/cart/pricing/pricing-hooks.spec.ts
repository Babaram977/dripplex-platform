import { FlatDeliveryFeeCalculator } from './flat-delivery-fee.calculator';
import { NigeriaTaxCalculator } from './nigeria-tax.calculator';
import { NoCouponEngine } from './no-coupon.engine';

describe('Cart pricing hooks', () => {
  it('NoCouponEngine always returns zero discount', async () => {
    const engine = new NoCouponEngine();
    await expect(
      engine.applyDiscount({
        customerId: 'c1',
        merchantId: 'm1',
        subtotal: 5000,
        currency: 'NGN',
      }),
    ).resolves.toBe(0);
  });

  it('NigeriaTaxCalculator applies configurable VAT', async () => {
    const calculator = new NigeriaTaxCalculator(0.075);
    await expect(
      calculator.calculateTax({
        subtotal: 10000,
        discount: 0,
        currency: 'NGN',
        country: 'NG',
      }),
    ).resolves.toBe(750);

    await expect(
      calculator.calculateTax({
        subtotal: 10000,
        discount: 2000,
        currency: 'NGN',
      }),
    ).resolves.toBe(600);
  });

  it('FlatDeliveryFeeCalculator returns configurable fee', async () => {
    const calculator = new FlatDeliveryFeeCalculator(1500);
    await expect(
      calculator.calculateFee({
        merchantId: 'm1',
        customerId: 'c1',
        subtotal: 5000,
        currency: 'NGN',
      }),
    ).resolves.toBe(1500);
  });
});
