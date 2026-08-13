import { Injectable } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface ResolvedCatalogItem {
  productId: string;
  variantId: string | null;
  merchantId: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: number;
  status: ProductStatus;
  isDeleted: boolean;
  trackInventory: boolean;
  manuallyDisabled: boolean;
  availableQuantity: number | null;
}

export interface CatalogLookupItem {
  productId: string;
  variantId?: string | null;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  public key(productId: string, variantId: string | null): string {
    return `${productId}:${variantId ?? ''}`;
  }

  public async resolveMany(items: CatalogLookupItem[]): Promise<Map<string, ResolvedCatalogItem>> {
    const resolved = new Map<string, ResolvedCatalogItem>();
    const productIds = [...new Set(items.map((item) => item.productId))];
    if (productIds.length === 0) {
      return resolved;
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        variants: true,
        inventory: true,
        images: { orderBy: { position: 'asc' }, take: 1 },
      },
    });
    const byProductId = new Map(products.map((product) => [product.id, product]));

    for (const item of items) {
      const product = byProductId.get(item.productId);
      if (!product) {
        continue;
      }

      const variant = item.variantId
        ? (product.variants.find((candidate) => candidate.id === item.variantId) ?? null)
        : null;

      resolved.set(this.key(item.productId, item.variantId ?? null), {
        productId: product.id,
        variantId: variant?.id ?? null,
        merchantId: product.merchantId,
        name: variant ? `${product.name} - ${variant.name}` : product.name,
        sku: variant?.sku ?? product.sku ?? null,
        imageUrl: product.images[0]?.url ?? null,
        unitPrice: Number(variant?.priceOverride ?? product.basePrice),
        status: product.status,
        isDeleted: product.isDeleted,
        trackInventory: product.inventory?.trackInventory ?? false,
        manuallyDisabled: product.inventory?.manuallyDisabled ?? false,
        availableQuantity: product.inventory
          ? product.inventory.quantity - product.inventory.reserved
          : null,
      });
    }

    return resolved;
  }

  public async resolveOne(item: CatalogLookupItem): Promise<ResolvedCatalogItem | null> {
    const resolved = await this.resolveMany([item]);
    return resolved.get(this.key(item.productId, item.variantId ?? null)) ?? null;
  }

  public isSellable(entry: ResolvedCatalogItem): boolean {
    return entry.status === ProductStatus.PUBLISHED && !entry.isDeleted && !entry.manuallyDisabled;
  }

  public hasStock(entry: ResolvedCatalogItem, quantity: number): boolean {
    // A merchant-forced "out of stock" blocks the sale regardless of quantity.
    if (entry.manuallyDisabled) {
      return false;
    }
    if (!entry.trackInventory) {
      return true;
    }
    return (entry.availableQuantity ?? 0) >= quantity;
  }
}
