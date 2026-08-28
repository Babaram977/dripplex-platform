import type { Prisma } from '@prisma/client';

/**
 * Whether a business has a location at all.
 *
 * `Business.latitude` and `Business.longitude` are non-nullable columns, so
 * "we do not know where this shop is" has no representation of its own. When
 * onboarding cannot resolve the address — the geocoder is unconfigured, the
 * request fails, or the address is too vague for Google to place — the create
 * falls back to `0`:
 *
 *     const latitude = dto.latitude ?? located?.latitude ?? 0;
 *
 * That is Null Island: the point in the Gulf of Guinea where the equator meets
 * the prime meridian, roughly 1,637 km from Kano and several hundred kilometres
 * from the nearest land. On 2026-08-28 three of the five live merchants were
 * sitting there — Nasara Pharmacy, dX Apartments and Gwarzo Furnitures — each
 * with a perfectly good Kano street address on file.
 *
 * Nothing said so. The store appeared in the marketplace, its detail page
 * looked complete, and it simply never came near the top of a "nearest" list
 * because it was, arithmetically, in the Atlantic.
 *
 * Both coordinates exactly zero is the marker. Nigeria spans about 4°N–14°N and
 * 2.6°E–14.7°E, so no DrippleX merchant can legitimately be at 0,0 — and the
 * pair is written together, so one being zero without the other means a real
 * (if surprising) reading rather than an absent one.
 */
export function hasKnownLocation(business: {
  latitude: Prisma.Decimal | number;
  longitude: Prisma.Decimal | number;
}): boolean {
  return !(Number(business.latitude) === 0 && Number(business.longitude) === 0);
}

/**
 * The address string to hand the geocoder.
 *
 * Minimal onboarding (founder decision) collects ONE free-text address line and
 * leaves `city` and `state` empty, so what reaches the geocoder is often a bare
 * street line. GoogleGeocoder already restricts to Nigeria — `region: 'ng'` and
 * `components: 'country:NG'` — but a street with no settlement is still a
 * guess, and the two merchants that did resolve are precisely the two whose
 * address carried its own qualifier.
 *
 * So anything the business does know is appended, and duplicates are dropped:
 * an address that already ends in "Kano" must not become "… Kano, Kano".
 */
export function geocodableAddress(business: {
  address: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): string {
  const parts = [business.address, business.city, business.state, business.country]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0);

  const seen = new Set<string>();
  return parts
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      // Already named inside the address line — "638 Murtala Muhammad way Kano"
      // needs no second "Kano".
      if (parts[0] !== part && parts[0]?.toLowerCase().includes(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
}
