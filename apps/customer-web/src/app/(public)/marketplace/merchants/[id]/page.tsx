import { notFound } from 'next/navigation';

import MerchantDetailClient from './merchant-detail-client';

import type { MerchantDetailDto } from '@dripplex/types';
import type { Metadata } from 'next';
import type * as React from 'react';

import { fetchPublicResource } from '@/lib/server-api';

/**
 * Same shape and the same reasoning as the product route next door: the check
 * lives in the page body because a `notFound()` in `generateMetadata` renders
 * the 404 page while leaving the status at `200` — Next 15 streams metadata,
 * so the response line has already gone.
 *
 * `GET merchants/:id` is `@Public()` and throws `NotFoundDomainException` for
 * an unknown id. Anything other than a 404 falls through to the client
 * component: a backend outage must not tell Google the shop has closed.
 */
export default async function MerchantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const merchant = await fetchPublicResource<MerchantDetailDto>(`merchants/${id}`);

  if (merchant === null) {
    notFound();
  }

  return <MerchantDetailClient />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const merchant = await fetchPublicResource<MerchantDetailDto>(`merchants/${id}`);

  if (merchant === null || merchant === undefined) {
    return {};
  }

  return { title: merchant.businessName };
}
