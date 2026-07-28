export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BrandDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImageDto {
  id: string;
  productId: string;
  url: string;
  altText: string | null;
  position: number;
  createdAt: string;
}

export interface ProductVariantDto {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  priceOverride: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInventoryDto {
  id: string;
  productId: string;
  quantity: number;
  reserved: number;
  available: number;
  lowStockAlert: number | null;
  trackInventory: boolean;
  updatedAt: string;
}

export interface ProductDto {
  id: string;
  merchantId: string;
  categoryId: string | null;
  brandId: string | null;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  currency: string;
  sku: string | null;
  status: ProductStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  images: ProductImageDto[];
  variants: ProductVariantDto[];
  inventory: ProductInventoryDto | null;
}

export interface CreateProductRequest {
  categoryId?: string;
  brandId?: string;
  name: string;
  description?: string;
  basePrice: number;
  currency?: string;
  sku?: string;
}

export interface UpdateProductRequest {
  categoryId?: string;
  brandId?: string;
  name?: string;
  description?: string;
  basePrice?: number;
  currency?: string;
  sku?: string;
}

export interface AddProductImageRequest {
  url: string;
  altText?: string;
  position?: number;
}

export interface ReorderProductImagesRequest {
  imageIds: string[];
}

export interface CreateProductVariantRequest {
  name: string;
  sku?: string;
  priceOverride?: number;
}

export interface UpdateProductVariantRequest {
  name?: string;
  sku?: string;
  priceOverride?: number;
  isActive?: boolean;
}

export interface UpdateProductInventoryRequest {
  quantity?: number;
  lowStockAlert?: number | null;
  trackInventory?: boolean;
}

export interface ListMerchantProductsQuery {
  status?: ProductStatus;
  page?: number;
  pageSize?: number;
}

export const PRODUCT_AUDIT_ACTIONS = {
  CREATED: 'product.created',
  UPDATED: 'product.updated',
  DELETED: 'product.deleted',
  PUBLISHED: 'product.published',
  UNPUBLISHED: 'product.unpublished',
  IMAGE_ADDED: 'product.image_added',
  IMAGE_REMOVED: 'product.image_removed',
  IMAGES_REORDERED: 'product.images_reordered',
  VARIANT_CREATED: 'product.variant_created',
  VARIANT_UPDATED: 'product.variant_updated',
  VARIANT_REMOVED: 'product.variant_removed',
  INVENTORY_UPDATED: 'product.inventory_updated',
} as const;

export type ProductAuditAction = (typeof PRODUCT_AUDIT_ACTIONS)[keyof typeof PRODUCT_AUDIT_ACTIONS];
