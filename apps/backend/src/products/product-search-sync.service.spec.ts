import { ProductStatus } from '@prisma/client';

import { DOMAIN_EVENTS } from '../events/domain-events';

import { ProductSearchSyncService } from './product-search-sync.service';

import type { ProductWithRelations } from './product.mapper';
import type { DomainEventBus } from '../events/domain-event-bus';

describe('ProductSearchSyncService', () => {
  function buildProduct(overrides: Partial<ProductWithRelations> = {}): ProductWithRelations {
    return {
      id: 'p1',
      merchantId: 'm1',
      categoryId: 'c1',
      brandId: 'b1',
      name: 'Rice',
      slug: 'rice',
      description: 'Tasty rice',
      basePrice: 4500 as unknown as ProductWithRelations['basePrice'],
      currency: 'NGN',
      sku: 'RICE-1',
      status: ProductStatus.PUBLISHED,
      isFeatured: false,
      isDeleted: false,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      images: [],
      variants: [],
      inventory: null,
      ...overrides,
    };
  }

  function buildEventBus(): { eventBus: DomainEventBus; emit: jest.Mock } {
    const emit = jest.fn().mockResolvedValue(undefined);
    return { eventBus: { emit } as unknown as DomainEventBus, emit };
  }

  it('marks a published, untracked-inventory product as available', async () => {
    const { eventBus, emit } = buildEventBus();
    const service = new ProductSearchSyncService(eventBus);

    await service.syncProduct(buildProduct());

    expect(emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.PRODUCT_CREATED,
      expect.objectContaining({ productId: 'p1', title: 'Rice', available: true }),
    );
  });

  it('marks a draft product as unavailable', async () => {
    const { eventBus, emit } = buildEventBus();
    const service = new ProductSearchSyncService(eventBus);

    await service.syncProduct(buildProduct({ status: ProductStatus.DRAFT }));

    expect(emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.PRODUCT_CREATED,
      expect.objectContaining({ available: false }),
    );
  });

  it('marks a deleted product as unavailable regardless of status', async () => {
    const { eventBus, emit } = buildEventBus();
    const service = new ProductSearchSyncService(eventBus);

    await service.syncProduct(buildProduct({ isDeleted: true }));

    expect(emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.PRODUCT_CREATED,
      expect.objectContaining({ available: false }),
    );
  });

  it('marks a tracked, zero-stock product as unavailable via INVENTORY_CHANGED', async () => {
    const { eventBus, emit } = buildEventBus();
    const service = new ProductSearchSyncService(eventBus);

    await service.syncInventory(
      buildProduct({
        inventory: {
          id: 'inv1',
          productId: 'p1',
          quantity: 0,
          reserved: 0,
          lowStockAlert: null,
          trackInventory: true,
          manuallyDisabled: false,
          lowStockNotifiedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    );

    expect(emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.INVENTORY_CHANGED,
      expect.objectContaining({ available: false }),
    );
  });

  it('marks a tracked, in-stock product as available', async () => {
    const { eventBus, emit } = buildEventBus();
    const service = new ProductSearchSyncService(eventBus);

    await service.syncInventory(
      buildProduct({
        inventory: {
          id: 'inv1',
          productId: 'p1',
          quantity: 10,
          reserved: 3,
          lowStockAlert: null,
          trackInventory: true,
          manuallyDisabled: false,
          lowStockNotifiedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    );

    expect(emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.INVENTORY_CHANGED,
      expect.objectContaining({ available: true }),
    );
  });

  it('marks a manually disabled, in-stock product as unavailable', async () => {
    const { eventBus, emit } = buildEventBus();
    const service = new ProductSearchSyncService(eventBus);

    await service.syncInventory(
      buildProduct({
        inventory: {
          id: 'inv1',
          productId: 'p1',
          quantity: 10,
          reserved: 0,
          lowStockAlert: null,
          trackInventory: true,
          manuallyDisabled: true,
          lowStockNotifiedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    );

    expect(emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.INVENTORY_CHANGED,
      expect.objectContaining({ available: false }),
    );
  });
});
