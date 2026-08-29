import { Card, CardDescription, CardHeader, CardTitle } from '@dripplex/ui';
import { Bike, Home, Pill, ShoppingBag, Truck, UtensilsCrossed, Wallet } from 'lucide-react';
import * as React from 'react';

import { featureCatalog } from '@/lib/site';

const icons = {
  marketplace: ShoppingBag,
  food: UtensilsCrossed,
  parcel: Truck,
  ride: Bike,
  wallet: Wallet,
  pharmacy: Pill,
  home: Home,
} as const;

export function FeatureGrid(): React.JSX.Element {
  return (
    <section className="container py-20" aria-labelledby="features-heading">
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="features-heading"
          className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Everything you need, in one place
        </h2>
        <p className="text-muted-foreground mt-3">
          DrippleX brings the services you use every day into a single trusted platform.
        </p>
      </div>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {featureCatalog.map((feature) => {
          const Icon = icons[feature.id];
          return (
            <li key={feature.id}>
              <Card className="h-full transition-transform duration-200 hover:-translate-y-0.5">
                <CardHeader>
                  <div className="bg-brand-muted text-primary mb-2 flex h-10 w-10 items-center justify-center rounded-md">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
