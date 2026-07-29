import { Injectable } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';

import type { ProductWithRelations } from './product.mapper';

/**
 * Keeps the platform's generic SearchDocument index in sync with catalog
 * writes, via the existing PRODUCT_CREATED/INVENTORY_CHANGED subscriber
 * (search/search.subscriber.ts) that predates the catalog itself.
 */
@Injectable()
export class ProductSearchSyncService {
  constructor(private readonly eventBus: DomainEventBus) {}

  public async syncProduct(product: ProductWithRelations): Promise<void> {
    await this.eventBus.emit(
      DOMAIN_EVENTS.PRODUCT_CREATED,
      this.buildPayload(product, this.isAvailable(product)),
    );
  }

  public async syncInventory(product: ProductWithRelations): Promise<void> {
    await this.eventBus.emit(
      DOMAIN_EVENTS.INVENTORY_CHANGED,
      this.buildPayload(product, this.isAvailable(product)),
    );
  }

  private isAvailable(product: ProductWithRelations): boolean {
    if (product.status !== ProductStatus.PUBLISHED || product.isDeleted) {
      return false;
    }
    const inventory = product.inventory;
    if (!inventory?.trackInventory) {
      return true;
    }
    return inventory.quantity - inventory.reserved > 0;
  }

  private buildPayload(product: ProductWithRelations, available: boolean): Record<string, unknown> {
    return {
      productId: product.id,
      title: product.name,
      subtitle: product.sku ?? undefined,
      description: product.description ?? undefined,
      price: Number(product.basePrice),
      merchantId: product.merchantId,
      categoryId: product.categoryId ?? undefined,
      brandId: product.brandId ?? undefined,
      available,
      keywords: [product.name, product.sku, product.slug].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ),
    };
  }
}
