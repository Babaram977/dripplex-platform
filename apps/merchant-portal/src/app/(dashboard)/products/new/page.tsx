'use client';

import { Button, Card, CardContent, Input, Label, Textarea } from '@dripplex/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { describeSdkError, sdk } from '@/lib/sdk';

export default function NewProductPage(): React.JSX.Element {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [basePrice, setBasePrice] = React.useState('');
  const [currency, setCurrency] = React.useState('NGN');
  const [sku, setSku] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void (async () => {
      setSubmitting(true);
      setError(null);
      try {
        const product = await sdk.merchantProducts.create({
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          basePrice: Number(basePrice),
          currency: currency.trim().toUpperCase(),
          ...(sku.trim() ? { sku: sku.trim() } : {}),
        });
        router.push(`/products/${product.id}`);
      } catch (submitError) {
        setError(describeSdkError(submitError).description);
        setSubmitting(false);
      }
    })();
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">New product</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Starts as a draft. Publish it once images and inventory are set.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                minLength={2}
                maxLength={255}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                maxLength={4000}
                rows={4}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="basePrice">Price</Label>
                <Input
                  id="basePrice"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={basePrice}
                  onChange={(event) => {
                    setBasePrice(event.target.value);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  required
                  minLength={3}
                  maxLength={3}
                  value={currency}
                  onChange={(event) => {
                    setCurrency(event.target.value);
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sku">SKU (optional)</Label>
              <Input
                id="sku"
                maxLength={100}
                value={sku}
                onChange={(event) => {
                  setSku(event.target.value);
                }}
              />
            </div>

            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  router.push('/products');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create product'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
