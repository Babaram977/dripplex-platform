import { describe, expect, it } from 'vitest';

import { totalsForFulfillment } from './fulfillmentTotals';

/**
 * The server's own arithmetic, transcribed from PricingService.computeTotals and
 * pricing.constants.ts. Not imported: the backend is a separate build with its
 * own module graph, and this file has to be able to disagree with the client for
 * the comparison below to mean anything.
 *
 * If pricing changes on the server and nobody updates this, these tests keep
 * passing while the screen quietly starts lying — so the constants are named and
 * the assumption they encode is stated in the test titles.
 */
const VAT = 0.075;
const FLAT_DELIVERY_FEE = 1500;

function round(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function serverTotals(
  subtotal: number,
  discount: number,
  fulfillment: 'DELIVERY' | 'PICKUP',
): { deliveryFee: number; total: number } {
  const tax = round(Math.max(0, subtotal - discount) * VAT);
  const deliveryFee = subtotal === 0 || fulfillment === 'PICKUP' ? 0 : FLAT_DELIVERY_FEE;
  return { deliveryFee, total: round(Math.max(0, subtotal - discount + tax + deliveryFee)) };
}

describe('totalsForFulfillment', () => {
  it('leaves a delivery order exactly as the cart computed it', () => {
    // The cart's totals ARE the delivery totals. Re-deriving them client-side
    // would add a second implementation of the price and a way for the two to
    // drift; this returns the same object contents untouched.
    const cart = serverTotals(8000, 0, 'DELIVERY');
    expect(totalsForFulfillment(cart, 'DELIVERY')).toEqual(cart);
  });

  it('reaches the same total the server will compute for a pickup order', () => {
    // The whole point of the file. The client only ever sees delivery-priced
    // totals before checkout, so it has to derive the pickup price — and it must
    // land on the server's figure, not near it. A mismatch means the amount
    // shown on the button is not the amount charged.
    const baskets = [
      [1200, 0],
      [8000, 0],
      [8000, 1500],
      [2499.99, 0],
      [17_850.55, 2_000.05],
      [333.33, 111.11],
      [1_000_000, 250_000],
    ] as const;

    for (const [subtotal, discount] of baskets) {
      const asDelivery = serverTotals(subtotal, discount, 'DELIVERY');
      const asPickup = serverTotals(subtotal, discount, 'PICKUP');

      expect(totalsForFulfillment(asDelivery, 'PICKUP')).toEqual(asPickup);
    }
  });

  it('shows no delivery fee on a pickup order', () => {
    const { deliveryFee } = totalsForFulfillment(serverTotals(8000, 0, 'DELIVERY'), 'PICKUP');
    expect(deliveryFee).toBe(0);
  });

  it('is a no-op on an empty basket, which is already free to deliver', () => {
    // subtotal === 0 zeroes the fee server-side regardless of fulfilment, so
    // there is nothing to subtract and nothing to get wrong.
    const empty = serverTotals(0, 0, 'DELIVERY');
    expect(empty.deliveryFee).toBe(0);
    expect(totalsForFulfillment(empty, 'PICKUP')).toEqual(empty);
  });

  it('never shows a negative price', () => {
    // Cannot arise from the formula — the fee is added to the total before it is
    // subtracted here. Pinned anyway: a negative figure on the pay button is a
    // worse failure than a wrong one, because it looks like the app owes money.
    expect(totalsForFulfillment({ deliveryFee: 1500, total: 400 }, 'PICKUP').total).toBe(0);
  });

  it('does not accumulate floating-point noise across the subtraction', () => {
    // 17850.55 - 2000.05 + VAT + 1500 is exactly the shape that produces
    // 20_...00000000003 without the rounding the server applies.
    const asDelivery = serverTotals(17_850.55, 2_000.05, 'DELIVERY');
    const { total } = totalsForFulfillment(asDelivery, 'PICKUP');

    expect(Number.isInteger(Math.round(total * 100))).toBe(true);
    expect(total).toBe(serverTotals(17_850.55, 2_000.05, 'PICKUP').total);
  });
});
