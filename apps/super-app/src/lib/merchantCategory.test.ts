import { describe, expect, it } from 'vitest';

import { categoryForBusinessTypeLabel } from '../app/onboardingScreen';
import { MERCHANT_CATEGORY_LABEL } from './api';

import type { MerchantCategory } from './api';

/**
 * The category a merchant picks at signup must survive to the database.
 *
 * ## The bug this pins
 *
 * Merchant signup asks "Business Type" and offers twelve retail categories.
 * The chosen **label** was carried forward and written into the business
 * *description*, while `Business.category` — a column the backend has accepted
 * on create and update all along — was left null.
 *
 * Nothing failed. Registration succeeded, the merchant saw their store, and
 * the description read "Hotels & Hospitality". But an uncategorised business
 * appears only under "All" in the marketplace, never under its own filter, and
 * a hotel is recognised as a hotel by `category === 'HOTEL'` and nothing else —
 * so its store page rendered the empty product grid instead of its rooms.
 *
 * A hotel could register perfectly and still be invisible and unbookable, with
 * no error at any step. That is why production had three merchants and zero
 * hotels while the whole booking stack sat finished behind it.
 *
 * ## Why a mapping test rather than a flow test
 *
 * The defect was a value being dropped between a dropdown and a request body.
 * The thing worth pinning is that every label the dropdown can show resolves to
 * a real enum member, and that the one label the hotel flow depends on resolves
 * to `HOTEL` specifically.
 */
describe('signup business type maps to a real merchant category', () => {
  it('maps the hotel option to HOTEL, which is what makes rooms bookable', () => {
    // The single most load-bearing entry: HotelRoomsPanel renders on this and
    // nothing else, and the marketplace Hotels filter queries on it.
    expect(categoryForBusinessTypeLabel('Hotels & Hospitality')).toBe('HOTEL');
  });

  it('maps every option the dropdown offers', () => {
    const labels = [
      'Restaurant & Food',
      'Supermarket / Grocery',
      'Pharmacy & Health',
      'Fashion & Clothing',
      'Electronics',
      'Beauty & Cosmetics',
      'Hardware & Tools',
      'Furniture & Home',
      'Hotels & Hospitality',
      'Wholesale / B2B',
      'Professional Services',
      'Other',
    ];
    const unmapped = labels.filter((l) => categoryForBusinessTypeLabel(l) === null);
    expect(unmapped).toEqual([]);
  });

  it('only ever produces categories the backend enum actually has', () => {
    // Guards a typo'd or renamed enum member, which TypeScript catches at build
    // time but not if the mapping is ever loosened to strings.
    const known = new Set(Object.keys(MERCHANT_CATEGORY_LABEL) as MerchantCategory[]);
    const produced = [
      'Restaurant & Food',
      'Hotels & Hospitality',
      'Wholesale / B2B',
      'Professional Services',
      'Furniture & Home',
    ].map((l) => categoryForBusinessTypeLabel(l));

    expect(produced.every((c) => c !== null && known.has(c))).toBe(true);
  });

  /** An unrecognised label must resolve to null, not to a guess. The backend
   *  DTO makes category optional precisely so "unknown" can be sent as absent;
   *  defaulting to OTHER would file every future option under the wrong one. */
  it('returns null for a label it does not know rather than guessing', () => {
    expect(categoryForBusinessTypeLabel('Aeronautics')).toBeNull();
    expect(categoryForBusinessTypeLabel('')).toBeNull();
  });
});
