'use client';

import { LoadingSpinner } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import type { CategoryDto } from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

export function CategoryStrip(): React.JSX.Element | null {
  const [categories, setCategories] = React.useState<CategoryDto[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    sdk.products
      .listCategories()
      .then((data) => {
        if (!cancelled) {
          setCategories(data);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(describeSdkError(loadError).description);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return null;
  }

  if (!categories) {
    return (
      <div className="flex justify-center py-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/marketplace/products?categoryId=${category.id}`}
          className="border-border/70 hover:border-primary hover:text-primary shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
