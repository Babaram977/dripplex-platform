import { computeInStock } from './customer-product.mapper';

type Inv = Parameters<typeof computeInStock>[0];

const inv = (over: Partial<NonNullable<Inv>>): Inv =>
  ({
    id: 'inv1',
    productId: 'p1',
    quantity: 0,
    reserved: 0,
    lowStockAlert: null,
    trackInventory: false,
    manuallyDisabled: false,
    lowStockNotifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

describe('computeInStock', () => {
  it('is in stock when inventory is untracked and not manually disabled', () => {
    expect(computeInStock(inv({ trackInventory: false }))).toBe(true);
  });

  it('is out of stock when the merchant manually marked it out, even if untracked', () => {
    expect(computeInStock(inv({ trackInventory: false, manuallyDisabled: true }))).toBe(false);
  });

  it('is out of stock when the merchant manually marked it out, even with quantity', () => {
    expect(
      computeInStock(inv({ trackInventory: true, quantity: 10, manuallyDisabled: true })),
    ).toBe(false);
  });

  it('respects tracked quantity minus reservations when not manually disabled', () => {
    expect(computeInStock(inv({ trackInventory: true, quantity: 5, reserved: 2 }))).toBe(true);
    expect(computeInStock(inv({ trackInventory: true, quantity: 2, reserved: 2 }))).toBe(false);
  });

  it('treats a missing inventory row as in stock', () => {
    expect(computeInStock(null)).toBe(true);
  });
});
