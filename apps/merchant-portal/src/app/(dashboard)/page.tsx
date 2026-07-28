'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@dripplex/ui';
import { Package, PackageCheck, PackageX, Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { BackendStatusPanel } from '@/components/backend-status-panel';
import { describeSdkError, sdk } from '@/lib/sdk';

interface ProductStats {
  total: number;
  published: number;
  draft: number;
}

export default function DashboardOverviewPage(): React.JSX.Element {
  const [stats, setStats] = React.useState<ProductStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadStats(): Promise<void> {
      try {
        const [all, published, draft] = await Promise.all([
          sdk.merchantProducts.list({ page: 1, pageSize: 1 }),
          sdk.merchantProducts.list({ page: 1, pageSize: 1, status: 'PUBLISHED' }),
          sdk.merchantProducts.list({ page: 1, pageSize: 1, status: 'DRAFT' }),
        ]);
        if (!cancelled) {
          setStats({
            total: all.meta.total,
            published: published.meta.total,
            draft: draft.meta.total,
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(describeSdkError(loadError).description);
        }
      }
    }

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Manage your DrippleX product catalog.
          </p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New product
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Total products
            </CardTitle>
            <Package className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stats?.total ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Published</CardTitle>
            <PackageCheck className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stats?.published ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Drafts</CardTitle>
            <PackageX className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stats?.draft ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <BackendStatusPanel />
    </div>
  );
}
