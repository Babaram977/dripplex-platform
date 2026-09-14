import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A refusal is never an empty state.
 *
 * Every merchant-facing list used to collapse a failed read into an empty
 * array, so a 403 rendered as a confident "No products yet" or "No orders".
 * Both are lies a merchant acts on: one goes hunting for a catalogue that is
 * still there, the other stops cooking because the kitchen screen says the
 * orders dried up.
 *
 * The Orders list is the sharp case and the reason this is not cosmetic — it
 * re-polls every six seconds, so the lie refreshes itself while real orders
 * arrive.
 */

const getOrders = vi.fn();
const getProducts = vi.fn();
const getCategories = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    merchant: {
      getOrders: (p?: unknown) => getOrders(p),
      getProducts: () => getProducts(),
    },
    marketplace: { getCategories: () => getCategories() },
  },
  uploadFile: vi.fn(),
  MERCHANT_CATEGORY_LABEL: {},
  CONNECT_PAGE_SIZE: 50,
}));

import { OrdersPage, ProductsPage } from './merchantScreen';

const apiError = (status: number, message: string): Error & { status: number } =>
  Object.assign(new Error(message), { status });

beforeEach(() => {
  vi.clearAllMocks();
  getCategories.mockResolvedValue([]);
  getOrders.mockResolvedValue({ items: [] });
  getProducts.mockResolvedValue({ items: [] });
});

describe('merchant lists distinguish a refusal from an empty result', () => {
  it('MLE-001 · a 403 on orders is a refusal, not "no orders"', async () => {
    getOrders.mockRejectedValue(apiError(403, 'The merchant module is not enabled'));
    render(<OrdersPage onDetail={() => undefined} />);

    expect(await screen.findByText('Not available to this account')).toBeTruthy();
    expect(screen.getByText('The merchant module is not enabled')).toBeTruthy();
    // The claim that would make a merchant stop cooking must be absent.
    expect(screen.queryByText(/No\s+orders/)).toBeNull();
  });

  it('MLE-002 · a 403 on products is a refusal, not "No products yet"', async () => {
    getProducts.mockRejectedValue(apiError(403, 'Access denied'));
    render(<ProductsPage />);

    expect(await screen.findByText('Not available to this account')).toBeTruthy();
    // "No products yet" invites the merchant to add a product they already
    // have, which is worse than a blank screen.
    expect(screen.queryByText('No products yet')).toBeNull();
    expect(screen.queryByText('+ Add your first product')).toBeNull();
  });

  it('MLE-003 · a non-403 failure is reported too, and reads differently', async () => {
    getProducts.mockRejectedValue(apiError(500, 'Upstream timed out'));
    render(<ProductsPage />);

    // A server fault is not an access problem; telling a merchant they lack
    // access would send them to support for the wrong thing.
    expect(await screen.findByText('Could not load')).toBeTruthy();
    expect(screen.getByText('Upstream timed out')).toBeTruthy();
    expect(screen.queryByText('Not available to this account')).toBeNull();
  });

  it('MLE-004 · a genuine empty result still reads as empty', async () => {
    render(<ProductsPage />);
    // The fix must not turn every empty catalogue into an error.
    expect(await screen.findByText('No products yet')).toBeTruthy();
    expect(screen.queryByText('Not available to this account')).toBeNull();
    expect(screen.queryByText('Could not load')).toBeNull();
  });

  it('MLE-005 · orders recovering from a refusal clears the notice', async () => {
    getOrders.mockRejectedValue(apiError(403, 'Access denied'));
    render(<OrdersPage onDetail={() => undefined} />);
    await screen.findByText('Not available to this account');

    // The list re-polls; once the read succeeds the refusal must not persist,
    // or a transient failure would look permanent.
    getOrders.mockResolvedValue({ items: [] });
    await waitFor(
      () => {
        expect(screen.queryByText('Not available to this account')).toBeNull();
      },
      { timeout: 9000 },
    );
  }, 15000);
});
