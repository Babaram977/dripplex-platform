import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrderExceptionDto, PaginatedResult } from '@dripplex/types';

import { QueryHarness } from '@/test/promotions-fixtures';

const adminGetOrderExceptions = vi.fn<(query?: unknown) => Promise<unknown>>();

vi.mock('@/lib/sdk', async () => {
  const errors = await vi.importActual<Record<string, unknown>>('@dripplex/sdk/sdk-admin');
  return {
    ...errors,
    sdk: {
      orders: {
        adminGetOrderExceptions: (query?: unknown) => adminGetOrderExceptions(query),
      },
    },
  };
});

// The shell pulls in navigation, auth and routing that this screen's behaviour
// does not depend on.
vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { default: StalledOrdersQueuePage, formatWait } = await import('./page');

/**
 * DPX-ORDER-8D-C ops visibility — the stalled-order queue screen.
 *
 * The load-bearing assertion in this file is the LAST one: that the screen
 * offers no way to act on an exception. Everything else is presentation; that
 * one is the founder constraint for this increment.
 */

function anException(over: Partial<OrderExceptionDto> = {}): OrderExceptionDto {
  return {
    id: 'exc-1',
    orderId: 'order-1',
    type: 'STALLED_CONFIRMED',
    status: 'OPEN',
    detectedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    waitedMinutes: 6382,
    notifiedAt: new Date(Date.now() - 9 * 60_000).toISOString(),
    resolvedAt: null,
    resolvedStatus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: {
      id: 'order-1',
      orderNumber: 'DPX-20260911-F7GK1S',
      status: 'CONFIRMED',
      paymentStatus: 'PENDING',
      paymentMethod: 'CASH',
      fulfillmentType: 'DELIVERY',
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      total: 1000,
      currency: 'NGN',
      confirmedAt: new Date(Date.now() - 6382 * 60_000).toISOString(),
      createdAt: new Date(Date.now() - 6382 * 60_000).toISOString(),
    },
    ...over,
  };
}

function page(items: OrderExceptionDto[]): PaginatedResult<OrderExceptionDto> {
  return {
    items,
    meta: { page: 1, limit: 50, total: items.length, totalPages: 1 },
  };
}

function renderPage(): void {
  render(
    <QueryHarness>
      <StalledOrdersQueuePage />
    </QueryHarness>,
  );
}

describe('Stalled Orders queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminGetOrderExceptions.mockResolvedValue(page([anException()]));
  });

  it('SOQ-001 · shows the order and how long it has been waiting', async () => {
    renderPage();

    expect(await screen.findByText(/DPX-20260911-F7GK1S/)).toBeInTheDocument();
    // 6382 minutes rendered as minutes would bury the thing this queue exists
    // to make obvious.
    expect(screen.getByText(/Waited 4d 10h/)).toBeInTheDocument();
  });

  it('SOQ-002 · opens on the OPEN queue, not on everything', async () => {
    renderPage();

    await waitFor(() => {
      expect(adminGetOrderExceptions).toHaveBeenCalled();
    });
    // An operations queue that opens showing resolved history is a queue
    // nobody works.
    expect(adminGetOrderExceptions).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'OPEN' }),
    );
  });

  it('SOQ-003 · can switch to resolved exceptions', async () => {
    renderPage();
    await screen.findByText(/DPX-20260911-F7GK1S/);

    await userEvent.click(screen.getByRole('button', { name: 'Resolved' }));

    await waitFor(() => {
      expect(adminGetOrderExceptions).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RESOLVED' }),
      );
    });
  });

  it('SOQ-004 · says when the merchant warning has not gone out yet', async () => {
    adminGetOrderExceptions.mockResolvedValue(page([anException({ notifiedAt: null })]));
    renderPage();

    // A null notifiedAt means the sweep will retry, not that the warning was
    // lost — the screen should not imply the merchant has been told.
    expect(await screen.findByText(/Merchant warning pending retry/)).toBeInTheDocument();
  });

  it('SOQ-005 · says so when nothing is stalled', async () => {
    adminGetOrderExceptions.mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText('No stalled orders')).toBeInTheDocument();
  });

  it('SOQ-006 · surfaces a failure instead of rendering an empty queue', async () => {
    adminGetOrderExceptions.mockRejectedValue(new Error('backend down'));
    renderPage();

    // "No stalled orders" on a failed request tells an operator everything is
    // fine when nobody knows whether it is.
    expect(await screen.findByText("Couldn't load stalled orders")).toBeInTheDocument();
    expect(screen.queryByText('No stalled orders')).not.toBeInTheDocument();
  });

  it('SOQ-007 · offers no way to act on an exception', async () => {
    renderPage();
    await screen.findByText(/DPX-20260911-F7GK1S/);

    // THE CONSTRAINT FOR THIS INCREMENT. The 2026-09-16 ruling escalates a
    // stalled order; it authorises nobody to cancel, decline, refund or
    // resolve one. If a control for any of that appears here, it shipped
    // without a ruling.
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);

    // The two status filters and nothing else. Any action control added later
    // breaks this equality, which is the point — it should not be possible to
    // ship one quietly.
    expect(buttons).toEqual(['Open', 'Resolved']);

    // Checked against the NON-filter controls only: 'Resolved' is a filter
    // label and would otherwise match /resolve/i and fail for the wrong reason.
    const actionControls = buttons.filter((label) => label !== 'Open' && label !== 'Resolved');
    for (const forbidden of [/resolve/i, /dismiss/i, /cancel/i, /refund/i, /decline/i, /assign/i]) {
      expect(actionControls.some((label) => forbidden.test(label))).toBe(false);
    }
  });
});

describe('formatWait', () => {
  it('SOQ-008 · reads as minutes, hours then days', () => {
    expect(formatWait(45)).toBe('45m');
    expect(formatWait(90)).toBe('1h 30m');
    expect(formatWait(120)).toBe('2h');
    expect(formatWait(6382)).toBe('4d 10h');
  });
});
