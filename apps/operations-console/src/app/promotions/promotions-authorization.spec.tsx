import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acquisitionIncentive,
  campaignDetail,
  QueryHarness,
  required,
} from '@/test/promotions-fixtures';

/**
 * DPX-PROMO-REF-001 — the guardrails, asserted rather than asserted-to.
 *
 * Everything here exists because the frontend is NOT the security boundary and
 * must never become one by accident: permission checks decide which controls
 * are drawn, the server decides what happens.
 */

const permissions = new Set<string>();

vi.mock('@dripplex/hooks', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@dripplex/hooks');
  return { ...actual, usePermission: (permission: string) => permissions.has(permission) };
});

const campaign = vi.fn<(id: string) => Promise<unknown>>();
const removePromoter = vi.fn<(id: string) => Promise<unknown>>();
const addPromoter = vi.fn<(id: string, body: unknown) => Promise<unknown>>();

vi.mock('@/lib/sdk', async () => {
  const errors = await vi.importActual<Record<string, unknown>>('@dripplex/sdk/sdk-admin');
  return {
    ...errors,
    sdk: {
      operationsPromotions: {
        campaigns: () => Promise.resolve([]),
        campaign: (id: string) => campaign(id),
        acquisitionIncentive: () => Promise.resolve(acquisitionIncentive),
        addPromoter: (id: string, body: unknown) => addPromoter(id, body),
        removePromoter: (id: string) => removePromoter(id),
      },
      adminLoyalty: { settings: () => Promise.resolve({ pointsPerNaira: 100 }) },
    },
  };
});

const { CampaignDetail } = await import('./[promotionId]/page');

beforeEach(() => {
  vi.clearAllMocks();
  permissions.clear();
  permissions.add('operations:promotions:read');
  campaign.mockResolvedValue(campaignDetail);
});

function renderDetail(): void {
  render(
    <QueryHarness>
      <CampaignDetail promotionId="campaign-1" />
    </QueryHarness>,
  );
}

describe('the client permission flag is presentation, not enforcement', () => {
  it('holding the manage flag does not make the server accept a removal', async () => {
    const user = userEvent.setup();
    const { DripplexApiError } = await import('@dripplex/sdk/sdk-admin');
    // The only thing the flag bought is a button. The server still refuses.
    permissions.add('operations:promotions:manage');
    removePromoter.mockRejectedValue(
      new DripplexApiError({
        statusCode: 403,
        message: 'You do not have permission to perform this action.',
        errorCode: 'FORBIDDEN',
        path: '/p',
      } as never),
    );
    renderDetail();
    await screen.findByText('Amaka Pioneer');

    await user.click(
      required(screen.getAllByRole('button', { name: 'Remove' })[0], 'a Remove button'),
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    const row = screen.getByText('Amaka Pioneer').closest('tr') as HTMLElement;
    expect(within(row).getByText('ACTIVE')).toBeInTheDocument();
    expect(within(row).queryByText('REMOVED')).not.toBeInTheDocument();
  });

  it('holding the manage flag does not make the server accept an addition', async () => {
    const user = userEvent.setup();
    const { DripplexApiError } = await import('@dripplex/sdk/sdk-admin');
    permissions.add('operations:promotions:manage');
    addPromoter.mockRejectedValue(
      new DripplexApiError({
        statusCode: 403,
        message: 'You do not have permission to perform this action.',
        errorCode: 'FORBIDDEN',
        path: '/p',
      } as never),
    );
    renderDetail();
    await screen.findByText('Amaka Pioneer');

    const form = screen.getByRole('form', { name: 'Add promoter' });
    await user.type(within(form).getByRole('textbox'), 'user-1');
    await user.type(within(form).getByLabelText('Amount (₦)'), '350');
    await user.click(within(form).getByRole('button', { name: 'Add promoter' }));

    expect(
      await screen.findByText('You do not have permission to perform this action.'),
    ).toBeInTheDocument();
    // Three promoters before, three after: nothing was added optimistically.
    expect(screen.getAllByText('••••••••')).toHaveLength(3);
  });

  it('withholding the flag hides controls without hiding or filtering data', async () => {
    renderDetail();
    await screen.findByText('Amaka Pioneer');
    const withoutManage = screen.getAllByRole('row').length;
    const names = screen.getAllByRole('row').map((row) => row.textContent);

    screen.getByText('Promoters');
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();

    // Same data, with manage held. The permission changes the controls only —
    // it is not, and must never become, a filter on what the API returned.
    permissions.add('operations:promotions:manage');
    const { unmount } = render(
      <QueryHarness>
        <CampaignDetail promotionId="campaign-1" />
      </QueryHarness>,
    );
    await waitFor(() => {
      expect(screen.getAllByText('Amaka Pioneer').length).toBe(2);
    });
    unmount();

    expect(withoutManage).toBe(names.length);
  });
});

describe("the screen never filters one promoter out of another promoter's view", () => {
  it('renders exactly the promoters the API returned, in the order it returned them', async () => {
    renderDetail();
    await screen.findByText('Amaka Pioneer');

    const rendered = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(rendered).toEqual(campaignDetail.promoters.map((promoter) => promoter.name));
  });

  it('asks for the campaign by id and asks for nothing else', async () => {
    renderDetail();
    await screen.findByText('Amaka Pioneer');
    // No per-promoter fetch that a crafted id could be pointed at, and no
    // client-side scoping standing in for a server-side one.
    expect(campaign).toHaveBeenCalledWith('campaign-1');
    expect(campaign).toHaveBeenCalledTimes(1);
  });
});

/**
 * Source-level guard.
 *
 * The screens may display an amount the server sent; they may not contain one.
 * A literal here survives a founder repricing and goes on quoting a number
 * nobody will honour — which is exactly what the 200→100 DX Points change on
 * 2026-09-12 would have done to a hardcoded rate.
 */
describe('no authoritative amount is written into the frontend', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const sources = [
    path.resolve(dir, 'page.tsx'),
    path.resolve(dir, '[promotionId]/page.tsx'),
    path.resolve(dir, '../../components/promotions-panels.tsx'),
    path.resolve(dir, '../../components/promotions-primitives.tsx'),
    path.resolve(dir, '../../hooks/use-operations-promotions.ts'),
  ];

  /** Comments explain the rules; code must not encode them. */
  function code(file: string): string {
    return readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('*'))
      .join('\n');
  }

  it('hardcodes no DX Points conversion rate', () => {
    for (const file of sources) {
      expect(code(file)).not.toMatch(/pointsPerNaira\s*(\?\?|\|\|)\s*\d/);
      expect(code(file)).not.toMatch(/\/\s*(100|200)\b/);
    }
  });

  it('hardcodes no discount percentage or ride cap', () => {
    for (const file of sources) {
      const text = code(file);
      expect(text).not.toMatch(/\b0\.2\b/);
      expect(text).not.toMatch(/['"`]20%/);
      expect(text).not.toMatch(/maxDiscountedRides\s*(\?\?|\|\|)\s*\d/);
      expect(text).not.toMatch(/percentOff\s*(\?\?|\|\|)\s*\d/);
    }
  });

  it('hardcodes none of the founder-locked referral amounts', () => {
    for (const file of sources) {
      const text = code(file);
      for (const amount of ['150', '200', '350']) {
        expect(text).not.toMatch(new RegExp(`(₦|NGN)\\s*${amount}\\b`));
        expect(text).not.toMatch(new RegExp(`=\\s*${amount}\\b`));
      }
    }
  });

  it('offers no control that would create a second acquisition promotion', () => {
    for (const file of sources) {
      const text = code(file);
      expect(text).not.toMatch(/createPromotion|createIncentive|acquisitionIncentive\s*:\s*\{/);
    }
  });
});
