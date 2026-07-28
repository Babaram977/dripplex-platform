import { toProductImageDto, toProductVariantDto } from '../product.mapper';

import type { ProductWithRelations } from '../product.mapper';
import type {
  BrandDto,
  CategoryDto,
  ProductDetailDto,
  ProductMerchantSummaryDto,
  ProductSummaryDto,
  RatingSummaryDto,
} from '@dripplex/types';
import type { Brand, Category } from '@prisma/client';

export const ZERO_RATING: RatingSummaryDto = { average: 0, count: 0 };

export function computeInStock(inventory: ProductWithRelations['inventory']): boolean {
  if (!inventory?.trackInventory) {
    return true;
  }
  return inventory.quantity - inventory.reserved > 0;
}

function primaryImageUrl(images: ProductWithRelations['images']): string | null {
  if (images.length === 0) {
    return null;
  }
  return images.slice().sort((a, b) => a.position - b.position)[0]?.url ?? null;
}

export function toProductSummaryDto(
  product: ProductWithRelations,
  rating: RatingSummaryDto = ZERO_RATING,
  merchantName = 'Merchant',
): ProductSummaryDto {
  return {
    id: product.id,
    merchantId: product.merchantId,
    merchantName,
    categoryId: product.categoryId,
    brandId: product.brandId,
    name: product.name,
    slug: product.slug,
    basePrice: Number(product.basePrice),
    currency: product.currency,
    primaryImageUrl: primaryImageUrl(product.images),
    rating,
    inStock: computeInStock(product.inventory),
    isFeatured: product.isFeatured,
  };
}

export function toCategoryDto(category: Category): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    parentId: category.parentId,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function toBrandDto(brand: Brand): BrandDto {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
    isActive: brand.isActive,
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  };
}

export function toProductDetailDto(
  product: ProductWithRelations,
  rating: RatingSummaryDto,
  merchant: ProductMerchantSummaryDto | null,
  relatedProducts: ProductSummaryDto[],
): ProductDetailDto {
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
    isFeatured: product.isFeatured,
    publishedAt: product.publishedAt ? product.publishedAt.toISOString() : null,
    images: product.images
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toProductImageDto),
    variants: product.variants.filter((variant) => variant.isActive).map(toProductVariantDto),
    inStock: computeInStock(product.inventory),
    merchant,
    rating,
    relatedProducts,
  };
}
