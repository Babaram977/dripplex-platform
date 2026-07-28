'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoadingSpinner,
  Switch,
  Textarea,
} from '@dripplex/ui';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';

import type { ProductDto, ProductStatus } from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

const STATUS_BADGE_VARIANT: Record<ProductStatus, 'success' | 'secondary' | 'outline'> = {
  PUBLISHED: 'success',
  DRAFT: 'secondary',
  ARCHIVED: 'outline',
};

export default function ProductDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const router = useRouter();

  const [product, setProduct] = React.useState<ProductDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reload = React.useCallback(async () => {
    try {
      const data = await sdk.merchantProducts.get(productId);
      setProduct(data);
      return data;
    } catch (loadError) {
      setError(describeSdkError(loadError).description);
      return null;
    }
  }, [productId]);

  React.useEffect(() => {
    setLoading(true);
    void reload().finally(() => {
      setLoading(false);
    });
  }, [reload]);

  const withBusy = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (actionError) {
      setError(describeSdkError(actionError).description);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!product) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {error ?? 'Product not found.'}
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">{product.name}</h1>
            <Badge variant={STATUS_BADGE_VARIANT[product.status]}>{product.status}</Badge>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">/{product.slug}</p>
        </div>
        <div className="flex gap-2">
          {product.status === 'PUBLISHED' ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void withBusy(() => sdk.merchantProducts.unpublish(product.id))}
            >
              Unpublish
            </Button>
          ) : (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void withBusy(() => sdk.merchantProducts.publish(product.id))}
            >
              Publish
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Delete "${product.name}"? This cannot be undone.`)) {
                void withBusy(() => sdk.merchantProducts.remove(product.id)).then(() => {
                  router.push('/products');
                });
              }
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <ProductDetailsForm product={product} busy={busy} onSaved={() => void reload()} />
      <ProductImagesPanel product={product} busy={busy} setBusy={setBusy} onChanged={reload} />
      <ProductVariantsPanel product={product} busy={busy} setBusy={setBusy} onChanged={reload} />
      <ProductInventoryPanel product={product} busy={busy} setBusy={setBusy} onChanged={reload} />
    </div>
  );
}

function ProductDetailsForm({
  product,
  busy,
  onSaved,
}: {
  product: ProductDto;
  busy: boolean;
  onSaved: () => void;
}): React.JSX.Element {
  const [name, setName] = React.useState(product.name);
  const [description, setDescription] = React.useState(product.description ?? '');
  const [basePrice, setBasePrice] = React.useState(String(product.basePrice));
  const [sku, setSku] = React.useState(product.sku ?? '');
  const [isFeatured, setIsFeatured] = React.useState(product.isFeatured);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void (async () => {
      setSaving(true);
      setError(null);
      try {
        await sdk.merchantProducts.update(product.id, {
          name: name.trim(),
          description: description.trim(),
          basePrice: Number(basePrice),
          sku: sku.trim(),
          isFeatured,
        });
        onSaved();
      } catch (submitError) {
        setError(describeSdkError(submitError).description);
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              rows={4}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-price">Price ({product.currency})</Label>
              <Input
                id="edit-price"
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
              <Label htmlFor="edit-sku">SKU</Label>
              <Input
                id="edit-sku"
                value={sku}
                onChange={(event) => {
                  setSku(event.target.value);
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isFeatured} onCheckedChange={setIsFeatured} label="Featured" />
            <Label>Featured product</Label>
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProductImagesPanel({
  product,
  busy,
  setBusy,
  onChanged,
}: {
  product: ProductDto;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onChanged: () => Promise<ProductDto | null>;
}): React.JSX.Element {
  const [url, setUrl] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (actionError) {
      setError(describeSdkError(actionError).description);
    } finally {
      setBusy(false);
    }
  };

  const images = [...product.images].sort((a, b) => a.position - b.position);

  const move = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= images.length) {
      return;
    }
    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    if (!moved) {
      return;
    }
    reordered.splice(target, 0, moved);
    void run(() =>
      sdk.merchantProducts.reorderImages(product.id, {
        imageIds: reordered.map((image) => image.id),
      }),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Images</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {images.length === 0 ? (
          <p className="text-muted-foreground text-sm">No images yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {images.map((image, index) => (
              <li
                key={image.id}
                className="border-border/70 flex items-center gap-3 rounded-md border p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.altText ?? ''}
                  className="bg-muted h-14 w-14 shrink-0 rounded object-cover"
                />
                <span className="truncate text-sm">{image.url}</span>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy || index === 0}
                    aria-label="Move up"
                    onClick={() => {
                      move(index, -1);
                    }}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy || index === images.length - 1}
                    aria-label="Move down"
                    onClick={() => {
                      move(index, 1);
                    }}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label="Remove image"
                    onClick={() =>
                      void run(() => sdk.merchantProducts.removeImage(product.id, image.id))
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!url.trim()) {
              return;
            }
            void run(() => sdk.merchantProducts.addImage(product.id, { url: url.trim() })).then(
              () => {
                setUrl('');
              },
            );
          }}
        >
          <Input
            aria-label="Image URL"
            placeholder="https://…"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
          />
          <Button type="submit" variant="outline" disabled={busy}>
            Add
          </Button>
        </form>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProductVariantsPanel({
  product,
  busy,
  setBusy,
  onChanged,
}: {
  product: ProductDto;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onChanged: () => Promise<ProductDto | null>;
}): React.JSX.Element {
  const [name, setName] = React.useState('');
  const [priceOverride, setPriceOverride] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (actionError) {
      setError(describeSdkError(actionError).description);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variants</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {product.variants.length === 0 ? (
          <p className="text-muted-foreground text-sm">No variants yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {product.variants.map((variant) => (
              <li
                key={variant.id}
                className="border-border/70 flex items-center gap-3 rounded-md border p-2"
              >
                <span className="text-sm font-medium">{variant.name}</span>
                {variant.priceOverride !== null ? (
                  <span className="text-muted-foreground text-xs">
                    {product.currency} {variant.priceOverride}
                  </span>
                ) : null}
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <Switch
                    checked={variant.isActive}
                    label={`${variant.name} active`}
                    onCheckedChange={(checked) =>
                      void run(() =>
                        sdk.merchantProducts.updateVariant(product.id, variant.id, {
                          isActive: checked,
                        }),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label="Remove variant"
                    onClick={() =>
                      void run(() => sdk.merchantProducts.removeVariant(product.id, variant.id))
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              return;
            }
            void run(() =>
              sdk.merchantProducts.createVariant(product.id, {
                name: name.trim(),
                ...(priceOverride ? { priceOverride: Number(priceOverride) } : {}),
              }),
            ).then(() => {
              setName('');
              setPriceOverride('');
            });
          }}
        >
          <Input
            aria-label="Variant name"
            placeholder="e.g. Large"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <Input
            aria-label="Price override"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Price override"
            className="w-40"
            value={priceOverride}
            onChange={(event) => {
              setPriceOverride(event.target.value);
            }}
          />
          <Button type="submit" variant="outline" disabled={busy}>
            Add
          </Button>
        </form>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProductInventoryPanel({
  product,
  busy,
  setBusy,
  onChanged,
}: {
  product: ProductDto;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onChanged: () => Promise<ProductDto | null>;
}): React.JSX.Element {
  const inventory = product.inventory;
  const [quantity, setQuantity] = React.useState(String(inventory?.quantity ?? 0));
  const [lowStockAlert, setLowStockAlert] = React.useState(
    inventory?.lowStockAlert !== null && inventory?.lowStockAlert !== undefined
      ? String(inventory.lowStockAlert)
      : '',
  );
  const [trackInventory, setTrackInventory] = React.useState(inventory?.trackInventory ?? true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void (async () => {
      setSaving(true);
      setBusy(true);
      setError(null);
      try {
        await sdk.merchantProducts.updateInventory(product.id, {
          quantity: Number(quantity),
          lowStockAlert: lowStockAlert ? Number(lowStockAlert) : null,
          trackInventory,
        });
        await onChanged();
      } catch (submitError) {
        setError(describeSdkError(submitError).description);
      } finally {
        setSaving(false);
        setBusy(false);
      }
    })();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex items-center gap-3">
            <Switch
              checked={trackInventory}
              onCheckedChange={setTrackInventory}
              label="Track inventory"
            />
            <Label>Track inventory for this product</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                disabled={!trackInventory}
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lowStockAlert">Low-stock alert</Label>
              <Input
                id="lowStockAlert"
                type="number"
                min="0"
                disabled={!trackInventory}
                value={lowStockAlert}
                onChange={(event) => {
                  setLowStockAlert(event.target.value);
                }}
              />
            </div>
          </div>
          {inventory ? (
            <p className="text-muted-foreground text-xs">
              {inventory.reserved} reserved · {inventory.available} available
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || saving}>
              {saving ? 'Saving…' : 'Save inventory'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
