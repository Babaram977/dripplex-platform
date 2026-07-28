'use client';

import { Badge, Button, EmptyState, LoadingSpinner, Select } from '@dripplex/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import type { ProductDto, ProductStatus } from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

const PAGE_SIZE = 20;

const STATUS_BADGE_VARIANT: Record<ProductStatus, 'success' | 'secondary' | 'outline'> = {
  PUBLISHED: 'success',
  DRAFT: 'secondary',
  ARCHIVED: 'outline',
};

function formatPrice(basePrice: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(basePrice);
}

export default function ProductsListPage(): React.JSX.Element {
  const [items, setItems] = React.useState<ProductDto[]>([]);
  const [status, setStatus] = React.useState<ProductStatus | ''>('');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.merchantProducts.list({
        page,
        pageSize: PAGE_SIZE,
        ...(status ? { status } : {}),
      });
      setItems(result.items);
      setTotalPages(result.meta.totalPages);
    } catch (loadError) {
      setError(describeSdkError(loadError).description);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-2 text-sm">Manage your product catalog.</p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New product
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select
          aria-label="Filter by status"
          className="w-44"
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as ProductStatus | '');
          }}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Create your first product to start selling on DrippleX."
          action={
            <Button asChild>
              <Link href="/products/new">New product</Link>
            </Button>
          }
        />
      ) : (
        <div className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
          {items.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="hover:bg-muted flex items-center justify-between gap-4 px-4 py-3 transition-colors"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {formatPrice(product.basePrice, product.currency)}
                  {product.sku ? ` · ${product.sku}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {product.isFeatured ? <Badge variant="accent">Featured</Badge> : null}
                <Badge variant={STATUS_BADGE_VARIANT[product.status]}>{product.status}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
            }}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => {
              setPage((current) => Math.min(totalPages, current + 1));
            }}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
