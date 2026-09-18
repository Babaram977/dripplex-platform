import { configure, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { purchaseBuyerContact, purchaseBuyerLabel } from './adminConsoleScreen';

/**
 * The Bill Payments desk — who bought it, and what state is it in.
 *
 * Founder, 2026-09-18, on a customer whose airtime purchase failed six times:
 * the console "is not given enough details to check what is the problem and
 * customer cannot be identified".
 *
 * Two distinct faults, both of which this pins:
 *
 *  - THE BUYER WAS NOT ON THE SCREEN. The only person-shaped column was
 *    `customerIdentifier`, which is the number being TOPPED UP — routinely a
 *    relative's, and for BETTING not a number at all. `customerId` was on the
 *    payload and rendered nowhere. So the desk showed a plausible phone number
 *    that identified nobody, which is worse than showing none.
 *
 *  - THE FAILURE TABS WERE INCOMPLETE. AWAITING_PAYMENT was offered but the
 *    server rejected it (proved in the backend spec); FAILED was accepted by
 *    the server but never offered. Between them, the two tabs an operator
 *    wants when a customer says "it keeps not working" were the two that did
 *    not work.
 */

const purchases = vi.fn();
const float = vi.fn();
let permissions: string[] = [];

vi.mock('../lib/api', () => ({
  api: {
    auth: {
      me: () =>
        Promise.resolve({
          id: 'u-ops-1',
          email: 'ops@dripplex.test',
          phone: null,
          firstName: 'Dan',
          lastName: 'Operator',
          profilePhotoUrl: null,
          dateOfBirth: null,
          gender: null,
          status: 'ACTIVE',
          roles: ['operations_staff'],
          permissions,
        }),
    },
    admin: {
      listVehicles: () => Promise.resolve({ items: [] }),
      listDrivers: () => Promise.resolve({ items: [] }),
      getOpsCounters: () => Promise.resolve({ openIncidentsCount: 0, openSupportTicketsCount: 0 }),
    },
    adminUtilities: {
      purchases: (q: unknown) => purchases(q),
      float: () => float(),
      resolve: () => Promise.reject(new Error('not used in these tests')),
    },
  },
  MERCHANT_CATEGORY_LABEL: {},
}));

vi.mock('../lib/auth', () => ({
  auth: {
    getUser: () => ({ permissions, roles: ['operations_staff'] }),
    getAccessToken: () => 'token',
    setUser: () => undefined,
    clear: () => undefined,
  },
}));

vi.mock('../lib/maps', () => ({
  addressPredictions: () => Promise.resolve([]),
  geocodeAddress: () => Promise.resolve(null),
  mapsEnabled: () => false,
  mapsLibrary: () => Promise.resolve(null),
}));

const MANAGE = 'admin:utilities:manage';

const customer = (over: Record<string, unknown> = {}) => ({
  id: 'cust-1',
  firstName: 'Amina',
  lastName: 'Okonkwo',
  phone: '+2348011112222',
  email: 'amina@example.test',
  ...over,
});

const purchase = (over: Record<string, unknown> = {}) => ({
  id: 'up-1',
  serviceType: 'AIRTIME',
  // Deliberately NOT the buyer's own number — the whole point of the column.
  customerIdentifier: '+2348099999999',
  providerCode: 'MTN',
  planCode: null,
  amountCharged: 1000,
  quantity: null,
  beneficiaryName: null,
  paymentMethod: 'WALLET',
  status: 'PENDING',
  providerReference: null,
  deliveredToken: null,
  failureReason: null,
  createdAt: '2026-09-16T08:18:00.000Z',
  completedAt: null,
  customerId: 'cust-1',
  customer: customer(),
  providerCost: null,
  providerResponse: null,
  ...over,
});

const page = (items: unknown[], total = items.length) => ({
  items,
  meta: { page: 1, limit: 50, total, totalPages: 1 },
});

async function renderConsole() {
  const { AdminConsoleScreen } = await import('./adminConsoleScreen');
  return render(<AdminConsoleScreen initialPage="billpayments" />);
}

function pageBody(): HTMLElement {
  const body = document.querySelector('.dx-console-body');
  if (!(body instanceof HTMLElement)) throw new Error('console body not rendered');
  return body;
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = [MANAGE];
  purchases.mockResolvedValue(page([purchase()]));
  float.mockResolvedValue({
    configured: true,
    balance: 24489,
    currency: 'NGN',
    threshold: 5000,
    low: false,
    accountVerified: true,
    kycStatus: 'verified',
  });
});

configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  await import('./adminConsoleScreen');
});

describe('who bought it', () => {
  it('names the customer on the row', async () => {
    await renderConsole();
    await waitFor(() => {
      expect(screen.getByText('Amina Okonkwo')).toBeTruthy();
    });
  });

  it('shows the buyer’s own phone beside the number that was topped up', async () => {
    await renderConsole();
    await waitFor(() => {
      expect(screen.getByText('Amina Okonkwo')).toBeTruthy();
    });
    const text = pageBody().textContent ?? '';
    // Both numbers present, and they are different numbers. If the row ever
    // renders the topped-up number AS the customer, the second assertion is
    // what says so.
    expect(text).toContain('+2348011112222');
    expect(text).toContain('+2348099999999');
    expect(purchaseBuyerContact(customer())).not.toBe(purchase().customerIdentifier);
  });

  it('gives the desk a Customer column', async () => {
    await renderConsole();
    await waitFor(() => {
      expect(screen.getByText('Amina Okonkwo')).toBeTruthy();
    });
    const headers = [...pageBody().querySelectorAll('th')].map((th) => th.textContent);
    expect(headers).toContain('Customer');
  });

  it('says so plainly when the customer record has gone', async () => {
    purchases.mockResolvedValue(page([purchase({ customer: null })]));
    await renderConsole();
    await waitFor(() => {
      expect(screen.getByText('Unknown customer')).toBeTruthy();
    });
    // Not a blank cell: an unidentifiable purchase is still one somebody has
    // to decide about, so the row stays legible and says what is missing.
    expect(pageBody().textContent).toContain('No customer record');
  });

  it('falls back to the email when a customer has no phone', () => {
    // Phone is primary identity but optional — a web-path signup can have only
    // the email, and an operator still has to be able to reach them.
    expect(purchaseBuyerContact(customer({ phone: null }))).toBe('amina@example.test');
  });

  it('falls back to the email when a customer has no name', () => {
    expect(purchaseBuyerLabel(customer({ firstName: '', lastName: '' }))).toBe(
      'amina@example.test',
    );
  });

  it('never claims an identity it does not have', () => {
    expect(purchaseBuyerLabel(null)).toBe('Unknown customer');
    expect(purchaseBuyerContact(null)).toBe('No customer record');
  });
});

describe('the failure tabs', () => {
  it('offers every status the server accepts as a filter', async () => {
    await renderConsole();
    await waitFor(() => {
      expect(screen.getByText('Amina Okonkwo')).toBeTruthy();
    });
    const labels = [...pageBody().querySelectorAll('button')].map((b) => b.textContent);
    // FAILED is the one that was missing. AWAITING PAYMENT was offered but
    // 400ed; its server half is pinned in the backend spec.
    for (const expected of [
      'All',
      'AWAITING PAYMENT',
      'PENDING',
      'SUCCESSFUL',
      'FAILED',
      'REVERSED',
    ]) {
      expect(labels).toContain(expected);
    }
  });
});
