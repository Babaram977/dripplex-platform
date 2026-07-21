import { SearchEntityType } from '@prisma/client';

import { DOMAIN_EVENTS } from '../events/domain-events';

import { SearchSubscriber } from './search.subscriber';

import type { SearchService } from './search.service';
import type { DomainEventBus } from '../events/domain-event-bus';

describe('SearchSubscriber', () => {
  let eventBus: jest.Mocked<DomainEventBus>;
  let searchService: jest.Mocked<SearchService>;
  let subscriber: SearchSubscriber;

  beforeEach(() => {
    eventBus = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<DomainEventBus>;
    searchService = {
      upsertDocument: jest.fn(),
    } as unknown as jest.Mocked<SearchService>;
    subscriber = new SearchSubscriber(eventBus, searchService);
  });

  it('subscribes to product and inventory events on module init', () => {
    subscriber.onModuleInit();

    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.PRODUCT_CREATED, expect.any(Function));
    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.INVENTORY_CHANGED, expect.any(Function));
  });

  it('indexes product created events into search documents', async () => {
    await subscriber.handleProductCreated({
      name: DOMAIN_EVENTS.PRODUCT_CREATED,
      payload: {
        productId: '44444444-4444-4444-8444-444444444444',
        name: 'Blue Running Shoes',
        merchantId: '11111111-1111-4111-8111-111111111111',
        keywords: ['running', 'shoes'],
      },
      occurredAt: new Date().toISOString(),
    });

    expect(searchService.upsertDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: SearchEntityType.PRODUCT,
        entityId: '44444444-4444-4444-8444-444444444444',
        title: 'Blue Running Shoes',
        available: true,
      }),
    );
  });

  it('indexes inventory changes with availability from stock', async () => {
    await subscriber.handleInventoryChanged({
      name: DOMAIN_EVENTS.INVENTORY_CHANGED,
      payload: {
        productId: '44444444-4444-4444-8444-444444444444',
        productName: 'Blue Running Shoes',
        stock: 0,
      },
      occurredAt: new Date().toISOString(),
    });

    expect(searchService.upsertDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        available: false,
      }),
    );
  });

  it('skips indexing when payload lacks product identity', async () => {
    await subscriber.handleProductCreated({
      name: DOMAIN_EVENTS.PRODUCT_CREATED,
      payload: { name: 'Missing id' },
      occurredAt: new Date().toISOString(),
    });

    expect(searchService.upsertDocument).not.toHaveBeenCalled();
  });
});
