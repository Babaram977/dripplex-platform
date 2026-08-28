/**
 * What a pickup order costs, previewed on the client.
 *
 * The cart's stored totals are always computed as a DELIVERY: CartService calls
 * PricingService.computeTotals without a fulfillmentType, so the delivery fee is
 * baked into `total` before the customer has chosen anything. Checkout then
 * recomputes with the real fulfilment and the server's figure is authoritative
 * — but between those two moments the checkout screen has to show a number, and
 * showing the delivery figure for an order the customer is collecting means the
 * total drops at the moment they pay. That reads as a bug even though it is in
 * their favour.
 *
 * This is not an estimate of the server's answer, it reproduces it. Server-side
 * (PricingService.computeTotals):
 *
 *     deliveryFee = subtotal === 0 || fulfillmentType === 'PICKUP'
 *                     ? 0 : DEFAULT_FLAT_DELIVERY_FEE
 *     total       = round(max(0, subtotal - discount + tax + deliveryFee))
 *
 * Every other term is untouched by fulfilment, so the whole difference between a
 * DELIVERY total and a PICKUP total is the one flat fee. Subtracting it here
 * lands on the same figure, which is what fulfillmentTotals.spec asserts by
 * running both formulas against the same inputs.
 *
 * If pricing ever makes the delivery fee depend on distance or basket size, this
 * stops being exact and the screen must read the totals from the server instead.
 * The test named for that assumption is the thing that will fail.
 */
export type Fulfillment = 'DELIVERY' | 'PICKUP';

export interface FulfillmentTotals {
  deliveryFee: number;
  total: number;
}

/** PricingService.roundMoney — same epsilon nudge, so halfway cases agree. */
function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Adjust delivery-priced totals for the chosen fulfilment.
 *
 * DELIVERY returns the totals untouched — they were computed as a delivery
 * already, and re-deriving them would only introduce a way to get them wrong.
 */
export function totalsForFulfillment(
  totals: FulfillmentTotals,
  fulfillment: Fulfillment,
): FulfillmentTotals {
  if (fulfillment !== 'PICKUP') {
    return totals;
  }
  return {
    deliveryFee: 0,
    // max(0, …) mirrors the server rather than guarding against anything seen in
    // practice: a delivery fee larger than the total cannot arise from the
    // formula above, and if it ever did, a negative price on screen would be
    // worse than a zero.
    total: Math.max(0, roundMoney(totals.total - totals.deliveryFee)),
  };
}
