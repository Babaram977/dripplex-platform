import 'server-only';

/**
 * Server-side reads of the public Backend Core endpoints.
 *
 * This exists for one reason: a page cannot answer HTTP 404 unless the server
 * knows, while rendering, that the record is missing. `@/lib/sdk` is marked
 * `'use client'` and binds the browser's auth store, so it cannot be used
 * here — hence a small direct `fetch` rather than a second SDK instance.
 *
 * Deliberately limited to endpoints the backend marks `@Public()`
 * (`CustomerProductsController`, `CustomerMerchantsController`). Nothing here
 * carries a token, so it can never widen what an anonymous visitor may read.
 */

/** Same variable and fallback the browser SDK resolves. */
const API_BASE_URL = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3000/api/v1';

/**
 * `null` means the backend positively said 404 — the record does not exist.
 * `undefined` means the question could not be answered: a 5xx, a timeout, a
 * DNS failure.
 *
 * The two must not collapse into one value. Treating an unreachable API as
 * "not found" would serve 404 for products that exist, and Google removes
 * 404s from the index — one bad deploy would quietly delist the catalogue.
 * Callers render the client component and let it retry instead.
 */
export async function fetchPublicResource<T>(path: string): Promise<T | null | undefined> {
  try {
    const response = await fetch(`${API_BASE_URL}/${path}`, {
      headers: { accept: 'application/json' },
      // Detail pages change rarely and are read constantly. 5 minutes keeps a
      // crawl of the catalogue from becoming a load test of the API, and is
      // short enough that a delisted product starts 404ing promptly.
      next: { revalidate: 300 },
    });

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      return undefined;
    }

    const body = (await response.json()) as { success?: boolean; data?: T };
    if (body.success === false || body.data === undefined) {
      return undefined;
    }
    return body.data;
  } catch {
    return undefined;
  }
}
