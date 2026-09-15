import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Every product wore the same plate of food.
 *
 * The merchant Dashboard's "Products" summary rendered a hard-coded 🍛 in the
 * image slot of every row. It was never a fallback — `imageUrl` was not read at
 * all — so a merchant who had uploaded a photo could not see it, and a merchant
 * selling anything other than food was told their product was a curry. It shows
 * up on newly added products because that is when a merchant looks at the list,
 * but it affected every product of every merchant, photo or no photo.
 *
 * These tests assert DISTINGUISHING state rather than successful rendering.
 * "The products render" would have passed happily throughout the defect. So
 * each case below turns on two products that must NOT look the same, and the
 * hard-coded literal is asserted absent by name.
 */

const getOrders = vi.fn();
const getProducts = vi.fn();
const getKyc = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    merchant: {
      getOrders: (p?: unknown) => getOrders(p),
      getProducts: () => getProducts(),
      getKyc: () => getKyc(),
    },
  },
  uploadFile: vi.fn(),
  MERCHANT_CATEGORY_LABEL: {},
  CONNECT_PAGE_SIZE: 50,
}));

import { DashboardPage } from './merchantScreen';

/** The literal that used to be hard-coded into the image slot. */
const PLATE = '🍛';

const product = (over: Partial<Record<string, unknown>> & { id: string; name: string }) => ({
  description: null,
  price: 1500,
  basePrice: 1500,
  currency: 'NGN',
  category: null,
  categoryId: null,
  sku: null,
  imageUrl: null,
  inStock: true,
  published: true,
  status: 'PUBLISHED',
  stockQty: 0,
  variants: [],
  createdAt: '2026-09-15T00:00:00.000Z',
  updatedAt: '2026-09-15T00:00:00.000Z',
  ...over,
});

const renderDashboard = () =>
  render(
    <DashboardPage
      onNav={() => undefined}
      business={null}
      wallet={null}
      storeOpen={true}
      onToggleStore={() => undefined}
    />,
  );

/** The rows of the Dashboard's "Products" card, by the product names in them. */
const productRow = async (name: string) => {
  const label = await screen.findByText(name);
  const row = label.closest('.mx-row');
  expect(row).not.toBeNull();
  return row as HTMLElement;
};

beforeEach(() => {
  vi.clearAllMocks();
  getOrders.mockResolvedValue({ items: [] });
  getKyc.mockResolvedValue({ items: [], latest: null });
  getProducts.mockResolvedValue({ items: [] });
});

describe('the merchant dashboard shows each product its own image', () => {
  it('MPI-001 · two products with different photos show their own photo, not a shared one', async () => {
    getProducts.mockResolvedValue({
      items: [
        product({ id: 'p1', name: 'Ankara Shirt', imageUrl: 'https://cdn.test/shirt.jpg' }),
        product({ id: 'p2', name: 'Leather Sandals', imageUrl: 'https://cdn.test/sandals.jpg' }),
      ],
    });
    renderDashboard();

    const shirt = within(await productRow('Ankara Shirt')).getByRole('img');
    const sandals = within(await productRow('Leather Sandals')).getByRole('img');

    // The defect's signature: two different products rendering identically.
    expect(shirt.getAttribute('src')).toBe('https://cdn.test/shirt.jpg');
    expect(sandals.getAttribute('src')).toBe('https://cdn.test/sandals.jpg');
    expect(shirt.getAttribute('src')).not.toBe(sandals.getAttribute('src'));
  });

  it('MPI-002 · a product with a photo does not render the hard-coded plate', async () => {
    getProducts.mockResolvedValue({
      items: [product({ id: 'p1', name: 'Ankara Shirt', imageUrl: 'https://cdn.test/shirt.jpg' })],
    });
    renderDashboard();

    const row = await productRow('Ankara Shirt');
    // The merchant uploaded this photo. Anything else in the slot is the bug.
    expect(row.textContent).not.toContain(PLATE);
    expect(within(row).getByRole('img').getAttribute('src')).toBe('https://cdn.test/shirt.jpg');
  });

  it('MPI-003 · a product with no photo is not labelled as food', async () => {
    getProducts.mockResolvedValue({
      items: [product({ id: 'p1', name: 'Phone Charger', imageUrl: null })],
    });
    renderDashboard();

    const row = await productRow('Phone Charger');
    // A missing photo is a missing photo. It is not a plate of curry, and
    // asserting its absence is the point: a generic placeholder is allowed to
    // change, the food literal is not allowed back.
    expect(row.textContent).not.toContain(PLATE);
    // Something still occupies the slot, so the row does not collapse.
    expect(within(row).getByRole('img')).toBeTruthy();
  });

  it('MPI-004 · a product with a photo and one without do not look the same', async () => {
    getProducts.mockResolvedValue({
      items: [
        product({ id: 'p1', name: 'Ankara Shirt', imageUrl: 'https://cdn.test/shirt.jpg' }),
        product({ id: 'p2', name: 'Phone Charger', imageUrl: null }),
      ],
    });
    renderDashboard();

    const withPhoto = within(await productRow('Ankara Shirt')).getByRole('img');
    const without = within(await productRow('Phone Charger')).getByRole('img');

    // The photo is a real <img src>; the one with no photo is not, and must not
    // borrow the other product's image either.
    expect(withPhoto.getAttribute('src')).toBe('https://cdn.test/shirt.jpg');
    expect(without.getAttribute('src')).toBeNull();
    expect(without.textContent).not.toContain(PLATE);
  });

  it('MPI-005 · no row in the products summary renders the food literal', async () => {
    getProducts.mockResolvedValue({
      items: [
        product({ id: 'p1', name: 'Ankara Shirt', imageUrl: 'https://cdn.test/shirt.jpg' }),
        product({ id: 'p2', name: 'Phone Charger' }),
        product({ id: 'p3', name: 'Bag of Rice' }),
      ],
    });
    renderDashboard();

    await screen.findByText('Ankara Shirt');
    // The whole-surface assertion. The defect was one literal repeated down the
    // list, so the strongest statement is that it appears nowhere at all.
    expect(screen.queryByText(PLATE)).toBeNull();
    expect(document.body.textContent).not.toContain(PLATE);
  });
});
