import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Merchant Connect — the merchant-facing half of the POS integration.
 *
 * These tests deliberately do not assert "the data rendered". They assert the
 * *property the merchant acts on*: whether a product is publishable, whether a
 * conflict is still actionable, and whether a refusal is distinguishable from
 * an empty catalogue. Each of those is a decision a merchant makes with real
 * money behind it, and each has a failure mode that looks perfectly healthy on
 * screen.
 */

const listIntegrations = vi.fn();
const getIntegration = vi.fn();
const testIntegration = vi.fn();
const listImportedProducts = vi.fn();
const listConflicts = vi.fn();
const acknowledgeConflict = vi.fn();
const publishProduct = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    merchant: {
      publishProduct: (id: string) => publishProduct(id),
      connect: {
        listIntegrations: () => listIntegrations(),
        getIntegration: (id: string) => getIntegration(id),
        testIntegration: (id: string) => testIntegration(id),
        listImportedProducts: (id: string, params?: unknown) => listImportedProducts(id, params),
        listConflicts: (id: string, params?: unknown) => listConflicts(id, params),
        acknowledgeConflict: (id: string, note?: string) => acknowledgeConflict(id, note),
      },
    },
  },
  uploadFile: vi.fn(),
  MERCHANT_CATEGORY_LABEL: {},
  CONNECT_PAGE_SIZE: 50,
}));

import { MerchantConnectPage } from './merchantScreen';

const INTEGRATION = {
  integrationId: 'int-a',
  merchantId: 'm-1',
  vendorName: 'Till Systems',
  status: 'ACTIVE' as const,
  createdAt: '2026-09-01T00:00:00.000Z',
  credentials: [
    {
      id: 'cred-1',
      createdAt: '2026-09-01T00:00:00.000Z',
      status: 'ACTIVE' as const,
      publicSuffix: '****8516',
      scopes: ['catalog:write'],
    },
  ],
};

/** The fixture the founder ruling turns on: imported vs manual, draft vs published. */
const DRAFT_ROW = {
  id: 'sync-draft',
  externalSku: 'SKU-DRAFT',
  productId: 'prod-draft',
  productName: 'Jollof Rice',
  price: 2500,
  status: 'DRAFT' as const,
  publishedAt: null,
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
};
const PUBLISHED_ROW = {
  id: 'sync-published',
  externalSku: 'SKU-PUB',
  productId: 'prod-pub',
  productName: 'Suya Platter',
  price: 5000,
  status: 'PUBLISHED' as const,
  publishedAt: '2026-09-11T00:00:00.000Z',
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-11T00:00:00.000Z',
};
/** A SKU whose product is unmapped or soft-deleted — not publishable. */
const ORPHAN_ROW = {
  id: 'sync-orphan',
  externalSku: 'SKU-ORPHAN',
  productId: null,
  productName: null,
  price: null,
  status: null,
  publishedAt: null,
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
};

const page = <T,>(items: T[], total = items.length) => ({ items, total, page: 1, pageSize: 50 });

const apiError = (status: number, message: string): Error & { status: number } =>
  Object.assign(new Error(message), { status });

const openTab = async (name: string): Promise<void> => {
  // Wait on the tab strip rather than the vendor name: the vendor appears both
  // as the integration selector and as the overview heading, so it is not a
  // unique anchor.
  await screen.findByText('Overview');
  fireEvent.click(screen.getByText(name));
};

beforeEach(() => {
  vi.clearAllMocks();
  listIntegrations.mockResolvedValue([INTEGRATION]);
  listImportedProducts.mockResolvedValue(page([DRAFT_ROW, PUBLISHED_ROW, ORPHAN_ROW]));
  listConflicts.mockResolvedValue(page([]));
  publishProduct.mockResolvedValue({});
  acknowledgeConflict.mockResolvedValue({});
  testIntegration.mockResolvedValue({
    status: 'SUCCESS',
    message: 'Webhook reachable',
    testedAt: '2026-09-14T00:00:00.000Z',
  });
});

describe('Merchant Connect — catalogue', () => {
  it('MCF-001 · distinguishes published from unpublished by the control, not just a label', async () => {
    render(<MerchantConnectPage />);
    await openTab('Catalogue');

    await screen.findByText('Jollof Rice');

    // The draft carries a Publish control; the published product carries none.
    // A label alone would let a published row keep an action that 409s.
    expect(screen.getByText('Unpublished')).toBeTruthy();
    expect(screen.getByText('Published')).toBeTruthy();
    expect(screen.getAllByText('Publish')).toHaveLength(1);
  });

  it('MCF-002 · a product that is not in the catalogue cannot be selected for publishing', async () => {
    render(<MerchantConnectPage />);
    await openTab('Catalogue');
    await screen.findByText('SKU-ORPHAN');

    // Its product is unmapped or soft-deleted, so publishing would 404. The
    // checkbox is disabled rather than the failure being discovered on click.
    const orphan = screen.getByLabelText('Select SKU-ORPHAN') as HTMLInputElement;
    expect(orphan.disabled).toBe(true);

    const draft = screen.getByLabelText('Select Jollof Rice') as HTMLInputElement;
    expect(draft.disabled).toBe(false);
  });

  it('MCF-003 · publishing calls the existing merchant endpoint and re-reads real state', async () => {
    render(<MerchantConnectPage />);
    await openTab('Catalogue');
    await screen.findByText('Jollof Rice');

    // After publishing, the server reports it PUBLISHED — the screen must show
    // the resulting state, not an optimistic guess.
    listImportedProducts.mockResolvedValue(
      page([
        { ...DRAFT_ROW, status: 'PUBLISHED', publishedAt: '2026-09-14T00:00:00.000Z' },
        PUBLISHED_ROW,
        ORPHAN_ROW,
      ]),
    );

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(publishProduct).toHaveBeenCalledWith('prod-draft');
    });
    // Re-read, not assumed: the list is fetched again after the mutation.
    await waitFor(() => {
      expect(listImportedProducts).toHaveBeenCalledTimes(2);
    });
    // And the control is gone, because the row is now published.
    await waitFor(() => {
      expect(screen.queryByText('Publish')).toBeNull();
    });
  });

  it('MCF-004 · publish-selected publishes only the publishable selection', async () => {
    render(<MerchantConnectPage />);
    await openTab('Catalogue');
    await screen.findByText('Jollof Rice');

    fireEvent.click(screen.getByLabelText('Select Jollof Rice'));
    fireEvent.click(screen.getByText('Publish selected (1)'));

    await waitFor(() => {
      expect(publishProduct).toHaveBeenCalledTimes(1);
    });
    expect(publishProduct).toHaveBeenCalledWith('prod-draft');
  });

  it('MCF-005 · a 403 is an explicit refusal, never an empty catalogue', async () => {
    listImportedProducts.mockRejectedValue(apiError(403, 'The merchant module is not enabled'));
    render(<MerchantConnectPage />);
    await openTab('Catalogue');

    // The distinction that matters: a merchant told "no products" would go
    // looking for their catalogue. One told they lack access would not.
    expect(await screen.findByText('Not available to this account')).toBeTruthy();
    expect(screen.getByText('The merchant module is not enabled')).toBeTruthy();
    expect(screen.queryByText('This integration has not imported any products yet.')).toBeNull();
  });

  it('MCF-006 · states the total, so a capped page is not mistaken for the whole catalogue', async () => {
    listImportedProducts.mockResolvedValue(page([DRAFT_ROW], 412));
    render(<MerchantConnectPage />);
    await openTab('Catalogue');

    // Selecting products to publish from a silently truncated list is the
    // failure this guards; the ceiling is on screen.
    expect(await screen.findByText(/Showing 1 of 412 imported products/)).toBeTruthy();
  });
});

describe('Merchant Connect — conflicts', () => {
  const OPEN_CONFLICT = {
    id: 'c-1',
    conflictType: 'CATEGORY_UNMAPPED',
    externalId: 'SKU-9',
    dripplexValue: 'uncategorised',
    externalValue: 'Fast Food',
    status: 'OPEN' as const,
    resolution: null,
    resolvedAt: null,
    createdAt: '2026-09-12T00:00:00.000Z',
  };

  it('MCF-007 · acknowledging visibly moves the conflict to RESOLVED and drops the control', async () => {
    listConflicts.mockResolvedValue(page([OPEN_CONFLICT]));
    render(<MerchantConnectPage />);
    await openTab('Conflicts');
    await screen.findByText('CATEGORY_UNMAPPED');

    expect(screen.getByText('OPEN')).toBeTruthy();

    listConflicts.mockResolvedValue(
      page([
        {
          ...OPEN_CONFLICT,
          status: 'RESOLVED',
          resolution: 'Acknowledged by merchant',
          resolvedAt: '2026-09-14T00:00:00.000Z',
        },
      ]),
    );
    fireEvent.click(screen.getByText('Acknowledge'));

    await waitFor(() => {
      expect(acknowledgeConflict).toHaveBeenCalledWith('c-1', undefined);
    });
    expect(await screen.findByText('RESOLVED')).toBeTruthy();
    // No longer actionable — a second acknowledge is a 409.
    await waitFor(() => {
      expect(screen.queryByText('Acknowledge')).toBeNull();
    });
  });

  it('MCF-008 · a 409 reports that it was already acknowledged rather than failing', async () => {
    listConflicts.mockResolvedValue(page([OPEN_CONFLICT]));
    acknowledgeConflict.mockRejectedValue(
      apiError(409, 'This conflict has already been acknowledged'),
    );
    render(<MerchantConnectPage />);
    await openTab('Conflicts');
    await screen.findByText('CATEGORY_UNMAPPED');

    fireEvent.click(screen.getByText('Acknowledge'));

    expect(await screen.findByText('This conflict was already acknowledged.')).toBeTruthy();
  });

  it('MCF-009 · a 403 on conflicts is a refusal, not "no conflicts"', async () => {
    listConflicts.mockRejectedValue(apiError(403, 'Access denied'));
    render(<MerchantConnectPage />);
    await openTab('Conflicts');

    expect(await screen.findByText('Not available to this account')).toBeTruthy();
    expect(screen.queryByText('No conflicts raised by this integration.')).toBeNull();
  });
});

describe('Merchant Connect — integration management', () => {
  it('MCF-010 · reports meaningful credential state, not merely that a key exists', async () => {
    render(<MerchantConnectPage />);
    // A merchant debugging a dead till needs to know the key is active and
    // whether it has ever been used — "never used" is the tell.
    expect(await screen.findByText('1 active API key')).toBeTruthy();
    expect(screen.getByText(/never used/)).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('MCF-011 · an integration with no usable key says so in actionable terms', async () => {
    listIntegrations.mockResolvedValue([
      { ...INTEGRATION, credentials: [{ ...INTEGRATION.credentials[0], status: 'REVOKED' }] },
    ]);
    render(<MerchantConnectPage />);

    expect(
      await screen.findByText(
        'No active API key. This integration cannot authenticate until a key is issued.',
      ),
    ).toBeTruthy();
  });

  it('MCF-012 · a failing connection test is surfaced, not swallowed', async () => {
    testIntegration.mockResolvedValue({
      status: 'FAILED',
      message: 'Webhook unreachable after 5 seconds',
      testedAt: '2026-09-14T00:00:00.000Z',
    });
    render(<MerchantConnectPage />);
    fireEvent.click(await screen.findByText('Test connection'));

    expect(await screen.findByText(/Webhook unreachable after 5 seconds/)).toBeTruthy();
  });

  it('MCF-013 · a 403 listing integrations is a refusal, not "no integrations"', async () => {
    listIntegrations.mockRejectedValue(apiError(403, 'The merchant module is not enabled'));
    render(<MerchantConnectPage />);

    expect(await screen.findByText('Not available to this account')).toBeTruthy();
    expect(
      screen.queryByText('No point-of-sale system is connected to this store yet.'),
    ).toBeNull();
  });

  it('MCF-014 · asks the backend for one integration’s catalogue, not the whole product list', async () => {
    render(<MerchantConnectPage />);
    await openTab('Catalogue');

    // The founder ruling in one assertion: the catalogue is scoped to the
    // selected integration. A screen built on /merchant/products would mix in
    // manual drafts and other integrations' imports.
    await waitFor(() => {
      expect(listImportedProducts).toHaveBeenCalledWith('int-a', { page: 1 });
    });
  });
});
