import { randomUUID } from 'node:crypto';

import type { PaginatedResult, ProductDto, ProductImageDto, ProductInventoryDto, ProductVariantDto } from '@dripplex/types';
import type {
  Product,
  ProductImage,
  ProductInventory,
  ProductVariant,
} from '@prisma/client';

export type ProductWithRelations = Product & {
  images: ProductImage[];
  variants: ProductVariant[];
  inventory: ProductInventory | null;
};

function toProductImageDto(image: ProductImage): ProductImageDto {
  return {
    id: image.id,
    productId: image.productId,
    url: image.url,
    altText: image.altText,
    position: image.position,
    createdAt: image.createdAt.toISOString(),
  };
}

function toProductVariantDto(variant: ProductVariant): ProductVariantDto {
  return {
    id: variant.id,
    productId: variant.productId,
    name: variant.name,
    sku: variant.sku,
    priceOverride: variant.priceOverride === null ? null : Number(variant.priceOverride),
    isActive: variant.isActive,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  };
}

function toProductInventoryDto(inventory: ProductInventory): ProductInventoryDto {
  return {
    id: inventory.id,
    productId: inventory.productId,
    quantity: inventory.quantity,
    reserved: inventory.reserved,
    available: inventory.quantity - inventory.reserved,
    lowStockAlert: inventory.lowStockAlert,
    trackInventory: inventory.trackInventory,
    updatedAt: inventory.updatedAt.toISOString(),
  };
}

export function toProductDto(product: ProductWithRelations): ProductDto {
  return {
    id: product.id,
    merchantId: product.merchantId,
    categoryId: product.categoryId,
    brandId: product.brandId,
    name: product.name,
    slug: product.slug,
    description: product.description,
    basePrice: Number(product.basePrice),
    currency: product.currency,
    sku: product.sku,
    status: product.status,
    publishedAt: product.publishedAt ? product.publishedAt.toISOString() : null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    images: product.images
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toProductImageDto),
    variants: product.variants.map(toProductVariantDto),
    inventory: product.inventory ? toProductInventoryDto(product.inventory) : null,
  };
}

export function toPaginatedProducts(
  items: ProductWithRelations[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<ProductDto> {
  return {
    items: items.map(toProductDto),
    meta: {
      page,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    },
  };
}

export function slugify(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'product';
}

export function slugifyWithSuffix(value: string): string {
  return `${slugify(value)}-${randomUUID().slice(0, 8)}`;
}
