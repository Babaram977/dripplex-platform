import { notFound } from 'next/navigation';

import ProductDetailClient from './product-detail-client';

import type { ProductDetailDto } from '@dripplex/types';
import type { Metadata } from 'next';
import type * as React from 'react';

import { fetchPublicResource } from '@/lib/server-api';

/**
 * Decide whether this product exists before anything is rendered.
 *
 * Until this existed a deleted product answered `200` with an empty shell for
 * ever: nothing in customer-web called `notFound()`, and a component that
 * fetches in `useEffect` cannot influence a status line that was already sent.
 * Search Console reported the result as "Soft 404" on 2026-09-06.
 *
 * `GET products/:id` is `@Public()` on the backend and throws
 * `NotFoundDomainException` for an unknown id, so an anonymous server-side
 * read distinguishes the two cases.
 *
 * The check MUST live in the page body, not in `generateMetadata`. That was
 * measured, not assumed: an identical `notFound()` in `generateMetadata`
 * renders the 404 page but leaves the status at `200`, because Next 15 streams
 * metadata and the response line is gone by the time it resolves. The result
 * looks correct to a human and is still a soft 404 to a crawler — the exact
 * bug being fixed. Isolated probe routes confirmed the body placement returns
 * a real 404 and the metadata placement does not.
 *
 * A failure that is NOT a 404 deliberately falls through to the client
 * component. Google drops 404s from the index, so answering "gone" when the
 * true answer is "cannot say" would turn one API outage into a delisted
 * catalogue. The client fetch retries in the browser and shows its own error
 * state, exactly as before this wrapper existed.
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const product = await fetchPublicResource<ProductDetailDto>(`products/${id}`);

  if (product === null) {
    notFound();
  }

  return <ProductDetailClient />;
}

/**
 * Real per-product title and description. The listing pages were the only
 * marketplace URLs with meaningful metadata; every product shared the site
 * default. Next dedupes this fetch with the one above within a request.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchPublicResource<ProductDetailDto>(`products/${id}`);

  if (product === null || product === undefined) {
    return {};
  }

  return {
    title: product.name,
    description: product.description ?? undefined,
  };
}
