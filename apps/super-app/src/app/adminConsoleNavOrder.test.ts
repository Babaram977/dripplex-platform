import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The operator menu's ORDER, and the fact that ordering it changed nothing else.
 *
 * Founder instruction, 2026-09-18. Capability ported from the standalone
 * operations-console was reported as "still missing" from ops.dripplex.com. It
 * was not missing — it was appended. Every migrated page went on the end of
 * NAV_ITEMS in the order the migration reached it, so Inspection Centres sat
 * thirteen rows from Inspections, Payout Queue thirteen from Settlements, and
 * Commission Campaigns nine from Commissions. An operator scanning for them
 * where they belong did not find them.
 *
 * Two things are pinned here, and the second is the one that makes the first
 * safe to do:
 *
 *  1. The pairs that must stay together. A later append puts the next ported
 *     page on the end again; this fails when that separates a pair.
 *  2. THE SET IS UNCHANGED. A reorder that quietly drops an entry, relabels
 *     one, or widens a permission would look like a reorder in a diff and read
 *     like one in a review. The exhaustive table below is what distinguishes
 *     moving a row from editing it.
 *
 * Read from the source rather than imported, following adminConsolePermissions:
 * NAV_ITEMS is a literal, and a literal is what an operator gets.
 */
const CONSOLE = join(__dirname, 'adminConsoleScreen.tsx');

interface NavEntry {
  page: string;
  label: string;
  requires: string | null;
}

/**
 * The NAV_ITEMS literal, in order.
 *
 * Deliberately strict: an entry whose `page` cannot be read is a parse failure
 * rather than a silently shorter list, because a parser that quietly returns
 * fewer entries turns every assertion below into a weaker one.
 */
function navItems(): NavEntry[] {
  const source = readFileSync(CONSOLE, 'utf8');
  const start = source.indexOf('const NAV_ITEMS');
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('\n];', start);
  expect(end).toBeGreaterThan(start);
  const block = source.slice(start, end);

  const entries: NavEntry[] = [];
  for (const match of block.matchAll(/\{\s*(?:\/\/[^\n]*\n\s*)*page:\s*'([a-z]+)'[\s\S]*?\}/g)) {
    const text = match[0];
    const page = match[1] ?? '';
    const label = /label:\s*'([^']+)'/.exec(text)?.[1] ?? '';
    const requires = /requires:\s*'([^']+)'/.exec(text)?.[1] ?? null;
    expect(page).not.toBe('');
    expect(label).not.toBe('');
    entries.push({ page, label, requires });
  }
  return entries;
}

/**
 * Every entry, in order, with its permission.
 *
 * This is the whole menu written out. It is long on purpose: a table that lists
 * only what moved cannot tell a move from a deletion, and this change's entire
 * claim is that nothing but order changed.
 */
const EXPECTED: NavEntry[] = [
  { page: 'dashboard', label: 'Dashboard', requires: null },
  { page: 'livemap', label: 'Live Map', requires: null },
  { page: 'trips', label: 'Trips', requires: null },
  { page: 'history', label: 'History', requires: null },
  { page: 'fleets', label: 'Fleet Partners', requires: 'admin:fleets:manage' },
  { page: 'drivers', label: 'Drivers', requires: null },
  { page: 'drvkyc', label: 'Driver KYC', requires: null },
  { page: 'vehicles', label: 'Vehicles', requires: null },
  { page: 'inspections', label: 'Inspections', requires: null },
  {
    page: 'inspectioncentres',
    label: 'Inspection Centres',
    requires: 'admin:inspection-centres:manage',
  },
  { page: 'settlements', label: 'Settlements', requires: null },
  { page: 'payoutqueue', label: 'Payout Queue', requires: 'operations:finance:read' },
  { page: 'merchants', label: 'Merchants', requires: null },
  { page: 'riders', label: 'Riders', requires: null },
  { page: 'customers', label: 'Customers', requires: null },
  { page: 'pricing', label: 'Pricing', requires: null },
  { page: 'commissions', label: 'Commissions', requires: null },
  {
    page: 'commissioncampaigns',
    label: 'Commission Campaigns',
    requires: 'admin:commission-campaign:read',
  },
  { page: 'campaigns', label: 'Referral Campaigns', requires: 'operations:promotions:read' },
  { page: 'referrals', label: 'Referral Performance', requires: 'operations:finance:read' },
  { page: 'referralreview', label: 'Referral Review Queue', requires: 'operations:finance:read' },
  { page: 'referralprogrammes', label: 'Referral Programmes', requires: 'operations:finance:read' },
  { page: 'dxpoints', label: 'DX Points Earning', requires: 'admin:loyalty:manage' },
  { page: 'billpayments', label: 'Bill Payments', requires: null },
  { page: 'stalledorders', label: 'Stalled Orders', requires: 'admin:orders:read' },
  { page: 'recovery', label: 'Automatic Recovery', requires: 'admin:orders:read' },
  { page: 'incidents', label: 'Incidents', requires: null },
  { page: 'support', label: 'Support', requires: null },
  { page: 'analytics', label: 'Analytics', requires: null },
  { page: 'reports', label: 'Reports', requires: null },
  { page: 'settings', label: 'Settings', requires: null },
  { page: 'auditlogs', label: 'Audit Logs', requires: null },
  { page: 'profile', label: 'My Profile', requires: null },
];

/** What has to stay together, and why it is not obvious from the labels. */
const MUST_BE_ADJACENT: [string, string, string][] = [
  ['inspections', 'inspectioncentres', 'a centre is where an inspection happens'],
  ['settlements', 'payoutqueue', 'both answer who is owed money and whether it has gone out'],
  ['commissions', 'commissioncampaigns', 'a campaign is what overrides a commission'],
  [
    'stalledorders',
    'recovery',
    'two views of one situation: what stalled, and whether the platform will act',
  ],
];

describe('the operator menu', () => {
  it('lists every entry exactly once', () => {
    const pages = navItems().map((entry) => entry.page);
    expect(new Set(pages).size).toBe(pages.length);
  });

  it('is the same set of entries, with the same labels and permissions', () => {
    // The guard on the whole exercise. Order changed; nothing else may have.
    expect(navItems()).toEqual(EXPECTED);
  });

  it.each(MUST_BE_ADJACENT)('keeps %s beside %s — %s', (first, second) => {
    const pages = navItems().map((entry) => entry.page);
    const a = pages.indexOf(first);
    const b = pages.indexOf(second);
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(-1);
    // Adjacent in either direction: which of the pair comes first is a taste
    // question, and pinning it would fail a reasonable future swap for nothing.
    expect(Math.abs(a - b)).toBe(1);
  });

  it('no longer trails the migrated pages at the end of the menu', () => {
    // The shape of the original complaint, stated as a test: the last entries
    // before the account section must not be the ported ones. If a future
    // migration appends again, this is what says so.
    const pages = navItems().map((entry) => entry.page);
    const ported = ['inspectioncentres', 'payoutqueue', 'commissioncampaigns'];
    for (const page of ported) {
      const position = pages.indexOf(page);
      expect(position).toBeLessThan(pages.indexOf('billpayments'));
    }
  });
});
