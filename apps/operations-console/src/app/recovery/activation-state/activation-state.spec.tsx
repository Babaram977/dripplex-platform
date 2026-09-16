import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrderRecoveryActivationStateDto } from '@dripplex/types';

import { QueryHarness } from '@/test/promotions-fixtures';

const adminGetOrderRecoveryActivationState = vi.fn<() => Promise<unknown>>();

vi.mock('@/lib/sdk', async () => {
  const errors = await vi.importActual<Record<string, unknown>>('@dripplex/sdk/sdk-admin');
  return {
    ...errors,
    sdk: { orders: { adminGetOrderRecoveryActivationState } },
  };
});

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { default: RecoveryActivationStatePage } = await import('./page');

/**
 * DPX-ORDER-8D-RECOVERY — the operator's read of the activation state.
 *
 * The load-bearing assertions here are RAS-003 and RAS-004: an error must not
 * read as OFF, and nothing on this screen may arm, disarm or run anything.
 * Everything else is presentation.
 */
function renderPage(): void {
  render(
    <QueryHarness>
      <RecoveryActivationStatePage />
    </QueryHarness>,
  );
}

function state(
  over: Partial<OrderRecoveryActivationStateDto> = {},
): OrderRecoveryActivationStateDto {
  return { activated: false, activationAt: null, ...over };
}

describe('Automatic Recovery activation state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminGetOrderRecoveryActivationState.mockResolvedValue(state());
  });

  it('RAS-001 · inactive reads OFF with no boundary set', async () => {
    renderPage();

    expect(await screen.findByText('OFF')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('RAS-002 · active shows the exact activation boundary', async () => {
    adminGetOrderRecoveryActivationState.mockResolvedValue(
      state({ activated: true, activationAt: '2026-10-01T09:30:00.000Z' }),
    );
    renderPage();

    expect(await screen.findByText('ON')).toBeInTheDocument();
    // To the instant. A rounded or relative rendering would make "verify the
    // exact activation boundary" unanswerable from this screen.
    expect(screen.getByText('2026-10-01T09:30:00.000Z')).toBeInTheDocument();
  });

  it('RAS-003 · a failed read is shown as unknown, NOT as OFF', async () => {
    // THE CONSTRAINT. "We could not ask" and "the backstop is disarmed" are
    // different facts. Rendering the second when the first is true is how an
    // operator ends up reassured about something nobody checked — the exact
    // defect class this programme keeps finding.
    adminGetOrderRecoveryActivationState.mockRejectedValue(new Error('backend down'));
    renderPage();

    expect(await screen.findByText(/Couldn't read the activation state/)).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText('OFF')).not.toBeInTheDocument();
    expect(screen.queryByText('Not set')).not.toBeInTheDocument();
  });

  it('RAS-004 · offers no control that could arm, disarm or run recovery', async () => {
    renderPage();
    await screen.findByText('OFF');

    // The activation boundary is a code constant changed only by reviewed
    // deployment, deliberately, so that no runtime surface can move a financial
    // safety boundary. A button here would defeat that entirely.
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.queryAllByRole('textbox')).toEqual([]);
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(screen.queryAllByRole('switch')).toEqual([]);

    // Checked against INTERACTIVE elements, not body text. The prose
    // deliberately says the backstop "can cancel a stalled order and reverse a
    // DX Wallet payment" — that is what an operator needs to understand about
    // the armed state. Grepping the whole page for those words would fail on
    // its own explanation, the same way the stalled-orders queue would fail on
    // its "Resolved" filter label.
    const interactive = [
      ...screen.queryAllByRole('button'),
      ...screen.queryAllByRole('link'),
      ...screen.queryAllByRole('textbox'),
      ...screen.queryAllByRole('checkbox'),
      ...screen.queryAllByRole('switch'),
      ...Array.from(document.querySelectorAll('form, input, select, textarea')),
    ];
    expect(interactive).toEqual([]);
  });

  it('RAS-005 · asks the backend exactly once per view, uncached', async () => {
    renderPage();
    await screen.findByText('OFF');

    // Stale answers to "can the platform move money right now" are worse than
    // no answer, so the hook does not cache across views.
    expect(adminGetOrderRecoveryActivationState).toHaveBeenCalledTimes(1);
  });
});
