'use client';

import { useAuth } from '@dripplex/hooks';
import { Badge, Card } from '@dripplex/ui';
import { Percent } from 'lucide-react';
import * as React from 'react';

import type { PromotionDto } from '@dripplex/types';

import { sdk } from '@/lib/sdk';

function describePromotion(promo: PromotionDto): string {
  if (promo.percentOff !== null) {
    return `${String(promo.percentOff)}% off`;
  }
  if (promo.amountOff !== null) {
    return `₦${promo.amountOff.toLocaleString('en-NG')} off`;
  }
  if (promo.buyQty !== null && promo.getQty !== null) {
    return `Buy ${String(promo.buyQty)} get ${String(promo.getQty)}`;
  }
  return 'Special offer';
}

/** Promotions require an authenticated session on the backend — anonymous visitors see nothing here. */
export function PromotionsStrip(): React.JSX.Element | null {
  const { hydrated, isAuthenticated } = useAuth();
  const [promotions, setPromotions] = React.useState<PromotionDto[]>([]);

  React.useEffect(() => {
    if (!hydrated || !isAuthenticated) {
      return;
    }
    let cancelled = false;
    sdk.promotions
      .active()
      .then((data) => {
        if (!cancelled) {
          setPromotions(data);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hydrated, isAuthenticated]);

  if (!hydrated || !isAuthenticated || promotions.length === 0) {
    return null;
  }

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
      {promotions.map((promo) => (
        <Card
          key={promo.id}
          className="border-promotion/40 bg-promotion/10 flex shrink-0 items-center gap-2 px-4 py-3"
        >
          <Percent className="text-promotion h-4 w-4" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">{promo.name}</p>
            <Badge variant="promotion" className="mt-0.5">
              {describePromotion(promo)}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}
