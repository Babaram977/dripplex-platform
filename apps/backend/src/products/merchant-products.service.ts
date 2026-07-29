import { Injectable } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { ProductSearchSyncService } from './product-search-sync.service';
import { PRODUCT_AUDIT_ACTIONS, PRODUCT_CURRENCY_DEFAULT } from './product.constants';
import { slugify, slugifyWithSuffix, toPaginatedProducts, toProductDto } from './product.mapper';

import type { AddProductImageDto } from './dto/add-product-image.dto';
import type { CreateProductVariantDto } from './dto/create-product-variant.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListMerchantProductsQueryDto } from './dto/list-merchant-products-query.dto';
import type { ReorderProductImagesDto } from './dto/reorder-product-images.dto';
import type { UpdateProductInventoryDto } from './dto/update-product-inventory.dto';
import type { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { ProductWithRelations } from './product.mapper';
import type { PaginatedResult, ProductDto } from '@dripplex/types';

const PRODUCT_INCLUDE = {
  images: true,
  variants: true,
  inventory: true,
} satisfies Prisma.ProductInclude;

@Injectable()
export class MerchantProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly productSearchSync: ProductSearchSyncService,
  ) {}

  public async createProduct(
    userId: string,
    dto: CreateProductDto,
    context: AuditContext,
  ): Promise<ProductDto> {
    const merchantId = await this.requireMerchantId(userId);

    if (dto.categoryId) {
      await this.requireCategory(dto.categoryId);
    }
    if (dto.brandId) {
      await this.requireBrand(dto.brandId);
    }

    const slug = await this.uniqueSlug(merchantId, dto.name);

    const product = await this.prisma.product.create({
      data: {
        merchantId,
        categoryId: dto.categoryId ?? null,
        brandId: dto.brandId ?? null,
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() ?? null,
        basePrice: new Prisma.Decimal(dto.basePrice),
        currency: (dto.currency ?? PRODUCT_CURRENCY_DEFAULT).toUpperCase(),
        sku: dto.sku?.trim() ?? null,
        inventory: { create: { quantity: 0 } },
      },
      include: PRODUCT_INCLUDE,
    });

    await this.auditService.record(PRODUCT_AUDIT_ACTIONS.CREATED, { ...context, userId }, {
      resource: 'product',
      resourceId: product.id,
      metadata: { name: product.name },
    });
    await this.productSearchSync.syncProduct(product);

    return toProductDto(product);
  }

  public async updateProduct(
    userId: string,
    productId: string,
    dto: UpdateProductDto,
    context: AuditContext,
  ): Promise<ProductDto> {
    const owned = await this.requireOwnedProduct(userId, productId);

    if (dto.categoryId) {
      await this.requireCategory(dto.categoryId);
    }
    if (dto.brandId) {
      await this.requireBrand(dto.brandId);
    }

    const product = await this.prisma.product.update({
      where: { id: owned.id },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.brandId !== undefined ? { brandId: dto.brandId } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.basePrice !== undefined ? { basePrice: new Prisma.Decimal(dto.basePrice) } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency.toUpperCase() } : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku.trim() } : {}),
        ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
      },
      include: PRODUCT_INCLUDE,
    });

    await this.auditService.record(PRODUCT_AUDIT_ACTIONS.UPDATED, { ...context, userId }, {
      resource: 'product',
      resourceId: product.id,
    });
    await this.productSearchSync.syncProduct(product);

    return toProductDto(product);
  }

  public async deleteProduct(userId: string, productId: string, context: AuditContext): Promise<void> {
    const owned = await this.requireOwnedProduct(userId, productId);

    const product = await this.prisma.product.update({
      where: { id: owned.id },
      data: { isDeleted: true, status: ProductStatus.ARCHIVED },
      include: PRODUCT_INCLUDE,
    });

    await this.auditService.record(PRODUCT_AUDIT_ACTIONS.DELETED, { ...context, userId }, {
      resource: 'product',
      resourceId: owned.id,
    });
    await this.productSearchSync.syncProduct(product);
  }

  public async publishProduct(
    userId: string,
    productId: string,
    context: AuditContext,
  ): Promise<ProductDto> {
    const owned = await this.requireOwnedProduct(userId, productId);

    if (owned.status === ProductStatus.PUBLISHED) {
      throw new ConflictDomainException('Product is already published');
    }

    const product = await this.prisma.product.update({
      where: { id: owned.id },
      data: { status: ProductStatus.PUBLISHED, publishedAt: new Date() },
      include: PRODUCT_INCLUDE,
    });

    await this.auditService.record(PRODUCT_AUDIT_ACTIONS.PUBLISHED, { ...context, userId }, {
      resource: 'product',
      resourceId: product.id,
    });
    await this.productSearchSync.syncProduct(product);

    return toProductDto(product);
  }

  public async unpublishProduct(
    userId: string,
    productId: string,
    context: AuditContext,
  ): Promise<ProductDto> {
    const owned = await this.requireOwnedProduct(userId, productId);

    if (owned.status !== ProductStatus.PUBLISHED) {
      throw new ConflictDomainException('Product is not published');
    }

    const product = await this.prisma.product.update({
      where: { id: owned.id },
      data: { status: ProductStatus.ARCHIVED },
      include: PRODUCT_INCLUDE,
    });

    await this.auditService.record(PRODUCT_AUDIT_ACTIONS.UNPUBLISHED, { ...context, userId }, {
      resource: 'product',
      resourceId: product.id,
    });
    await this.productSearchSync.syncProduct(product);

    return toProductDto(product);
  }

  public async addImage(
    userId: string,
    productId: string,
    dto: AddProductImageDto,
    context: AuditContext,
  ): Promise<ProductDto> {
    const owned = await this.requireOwnedProduct(userId, productId);

    const position =
      dto.position ?? (owned.images.length > 0 ? Math.max(...owned.images.map((i) => i.position)) + 1 : 0);

    await this.prisma.productImage.create({
      data: {
        productId: owned.id,
        url: dto.url,
        altText: dto.altText?.trim() ?? null,
        position,
      },
    });

    await this.auditService.record(PRODUCT_AUDIT_ACTIONS.IMAGE_ADDED, { ...context, userId }, {
      resource: 'product',
      resourceId: owned.id,
    });

    return await this.getOwnProduct(userId, productId);
  }

  public async removeImage(
    userId: string,
    productId: string,
    imageId: string,
    context: AuditContext,
  ): Promise<ProductDto> {
    const owned = await this.requireOwnedProduct(userId, productId);
    const image = owned.images.find((candidate) => candidate.id === imageId);
    if (!image) {
      throw new NotFoundDomainException('Product image not found');
    }

    await this.prisma.productImage.delete({ where: { id: image.id } });

    await this.auditService.record(PRODUCT_AUDIT_ACTIONS.IMAGE_REMOVED, { ...context, userId }, {
      resource: 'product',
      resourceId: owned.id,
    });

    return await this.getOwnProduct(userId, productId);
  }

  public async reorderImages(
    userId: string,
    productId: string,
    dto: ReorderProductImagesDto,
    context: AuditContext,
  ): Promise<ProductDto> {
    const owned = await this.requireOwnedProduct(userId, productId);

    const ownedIds = new Set(owned.images.map((image) => image.id));
    const requestedIds = new Set(dto.imageIds);
    if (ownedIds.size !== requestedIds.size || [...ownedIds].some((id) => !requestedIds.has(id))) {
      throw new ValidationDomainException('imageIds must match the product\'s existing image set exactly');
    }

    await this.prisma.$transaction(
      dto.imageIds.map((imageId, index) =>
        this.prisma.productImage.update({ where: { id: imageId }, data: { position: index } }),
      ),
    );

    await this.auditService.record(PRODUCT_AUDIT_ACTIONS.IMAGES_REORDERED, { ...context, userId }, {
      resource: 'product',
      resourceId: owned.id,
    });

    return await this.getOwnProduct(userId, productId);
  }

  public async createVariant(
    userId: string,
    productId: string,
    dto: CreateProductVariantDto,
    context: AuditContext,
  ): Promise<ProductDto> {
    const owned = await this.requireOwnedProduct(userId, productId);

    await this.prisma.productVariant.create({
      data: {
        productId: owned.id,
        name: dto.name.trim(),
        sku: dto.sku?.trim() ?? null,
        priceOverride: dto.priceOverride !== undefined ? new Prisma.Decimal(dto.priceOverride) : null,
      },
    });

    await this.auditService.record(PRODUCT_AUDIT_ACTIONS.VARIANT_CREATED, { ...context, userId }, {
      resource: 'product',
      resourceId: owned.id,
    });

    return await this.getOwnProduct(userId, productId);
  }

  public async updateVariant(
    userId: string,
    productId: string,
    variantId: string,
    dto: UpdateProductVariantDto,
    context: AuditContext,
  ): Promise<ProductDto> {
    const owned = await this.requireOwnedProduct(userId, productId);
    const variant = owned.variants.find((candidate) => candidate.id === variantId);
    if (!variant) {
      throw new NotFoundDomainException('Product variant not found');
    }

    await this.prisma.productVariant.update({
      where: { id: variant.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku.trim() } : {}),
        ...(dto.priceOverride !== undefined
          ? { priceOverride: new Prisma.Decimal(dto.priceOverride) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.auditService.record(PRODUCT_AUDIT_ACTIONS.VARIANT_UPDATED, { ...context, userId }, {
      resource: 'product',
      resourceId: owned.id,
    });

    return await this.getOwnProduct(userId, productId);
  }

  public async removeVariant(
    userId: string,
    productId: string,
    variantId: string,
    context: AuditContext,
  ): Promise<ProductDto> {
    const owned = await this.requireOwnedProduct(userId, productId);
    const variant = owned.variants.find((candidate) => candidate.id === variantId);
    if (!variant) {
      throw new NotFoundDomainException('Product variant not found');
    }

    await this.prisma.productVariant.delete({ where: { id: variant.id } });

    await this.auditService.record(PRODUCT_AUDIT_ACTIONS.VARIANT_REMOVED, { ...context, userId }, {
      resource: 'product',
      resourceId: owned.id,
    });

    return await this.getOwnProduct(userId, productId);
  }

  public async updateInventory(
    userId: string,
    productId: string,
    dto: UpdateProductInventoryDto,
    context: AuditContext,
  ): Promise<ProductDto> {
    const owned = await this.requireOwnedProduct(userId, productId);

    await this.prisma.productInventory.upsert({
      where: { productId: owned.id },
      create: {
        productId: owned.id,
        quantity: dto.quantity ?? 0,
        lowStockAlert: dto.lowStockAlert ?? null,
        trackInventory: dto.trackInventory ?? true,
      },
      update: {
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.lowStockAlert !== undefined ? { lowStockAlert: dto.lowStockAlert } : {}),
        ...(dto.trackInventory !== undefined ? { trackInventory: dto.trackInventory } : {}),
      },
    });

    await this.auditService.record(PRODUCT_AUDIT_ACTIONS.INVENTORY_UPDATED, { ...context, userId }, {
      resource: 'product',
      resourceId: owned.id,
    });

    const refreshed = await this.requireOwnedProduct(userId, productId);
    await this.productSearchSync.syncInventory(refreshed);

    return toProductDto(refreshed);
  }

  public async listOwnProducts(
    userId: string,
    query: ListMerchantProductsQueryDto,
  ): Promise<PaginatedResult<ProductDto>> {
    const merchantId = await this.requireMerchantId(userId);
    const where: Prisma.ProductWhereInput = {
      merchantId,
      isDeleted: false,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return toPaginatedProducts(items, total, query.page, query.pageSize);
  }

  public async getOwnProduct(userId: string, productId: string): Promise<ProductDto> {
    const owned = await this.requireOwnedProduct(userId, productId);
    return toProductDto(owned);
  }

  private async requireMerchantId(userId: string): Promise<string> {
    const profile = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundDomainException('Merchant profile not found');
    }
    return profile.id;
  }

  private async requireOwnedProduct(
    userId: string,
    productId: string,
  ): Promise<ProductWithRelations> {
    const merchantId = await this.requireMerchantId(userId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, merchantId, isDeleted: false },
      include: PRODUCT_INCLUDE,
    });
    if (!product) {
      throw new NotFoundDomainException('Product not found');
    }
    return product;
  }

  private async requireCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new ValidationDomainException('Category not found');
    }
  }

  private async requireBrand(brandId: string): Promise<void> {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new ValidationDomainException('Brand not found');
    }
  }

  private async uniqueSlug(merchantId: string, name: string): Promise<string> {
    const base = slugify(name);
    const existing = await this.prisma.product.count({ where: { merchantId, slug: base } });
    return existing > 0 ? slugifyWithSuffix(name) : base;
  }
}
